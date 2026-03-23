/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import * as Lark from '@larksuiteoapi/node-sdk';
import { BrowserWindow } from 'electron';

import { logger } from '@main/logger';
import { runAgent } from '@main/services/runAgent';
import { store } from '@main/store/create';
import { SettingStore } from '@main/store/setting';
import { type AppState, Operator } from '@main/store/types';
import { showWindow } from '@main/window';
import { Conversation, StatusEnum } from '@ui-tars/shared/types';

import {
  FEISHU_TASK_RECEIVED_CHANNEL,
  type FeishuIncomingMessageEvent,
  type FeishuTaskFinalState,
  type FeishuTaskPayload,
  type RunningFeishuTask,
} from './types';
import {
  buildFeishuTextContent,
  extractFinishedMessage,
  formatFeishuAcceptedReply,
  formatFeishuBusyReply,
  formatFeishuFailureReply,
  formatFeishuSuccessReply,
  formatUnsupportedMessageReply,
  getFeishuConfigSignature,
  getFeishuServiceConfig,
  hasFeishuCredentials,
  isSupportedFeishuMessageType,
  isTerminalStatus,
  parseFeishuTextContent,
} from './utils';

const FEISHU_MESSAGE_TYPE_TEXT = 'text';

export class FeishuService {
  private static instance: FeishuService;

  private client: Lark.Client | null = null;
  private wsClient: Lark.WSClient | null = null;
  private settingsUnsubscribe: (() => void) | null = null;
  private storeUnsubscribe: (() => void) | null = null;
  private currentConfigSignature: string | null = null;
  private currentTask: RunningFeishuTask | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): FeishuService {
    if (!FeishuService.instance) {
      FeishuService.instance = new FeishuService();
    }

    return FeishuService.instance;
  }

  public initialize(): void {
    if (!this.settingsUnsubscribe) {
      this.settingsUnsubscribe = SettingStore.getInstance().onDidAnyChange(
        () => {
          this.scheduleRefreshFromSettings();
        },
      );
    }

    if (!this.storeUnsubscribe) {
      this.storeUnsubscribe = store.subscribe((state) => {
        void this.handleAppStateChange(state);
      });
    }

    this.scheduleRefreshFromSettings(0);
  }

  public dispose(): void {
    this.settingsUnsubscribe?.();
    this.settingsUnsubscribe = null;

    this.storeUnsubscribe?.();
    this.storeUnsubscribe = null;

    this.clearCurrentTask();
    this.clearRefreshTimer();
    this.closeConnection();
    this.client = null;
  }

  private scheduleRefreshFromSettings(delayMs = 800): void {
    this.clearRefreshTimer();

    this.refreshTimer = setTimeout(() => {
      void this.refreshFromSettings();
    }, delayMs);
  }

  private async refreshFromSettings(): Promise<void> {
    this.refreshTimer = null;

    const config = getFeishuServiceConfig(SettingStore.getStore());
    if (!hasFeishuCredentials(config)) {
      this.closeConnection();
      this.currentConfigSignature = null;
      return;
    }

    const nextSignature = getFeishuConfigSignature(config);
    if (nextSignature === this.currentConfigSignature && this.wsClient) {
      return;
    }

    logger.info(
      '[FeishuService] reconnecting long connection due to config change',
    );
    this.closeConnection();

    const baseConfig = {
      appId: config.appId,
      appSecret: config.appSecret,
      appType: Lark.AppType.SelfBuild,
      domain: Lark.Domain.Feishu,
    };

    this.client = new Lark.Client(baseConfig);

    const wsClient = new Lark.WSClient({
      ...baseConfig,
      loggerLevel: Lark.LoggerLevel.info,
    });

    try {
      await wsClient.start({
        eventDispatcher: new Lark.EventDispatcher({}).register({
          'im.message.receive_v1': async (data: FeishuIncomingMessageEvent) => {
            await this.handleIncomingTask(data, config.operator);
          },
        }),
      });

      this.wsClient = wsClient;
      this.currentConfigSignature = nextSignature;
      logger.info('[FeishuService] long connection started');
    } catch (error) {
      logger.error('[FeishuService] failed to start long connection:', error);
      wsClient.close({ force: true });
      this.wsClient = null;
      this.currentConfigSignature = null;
    }
  }

  private closeConnection(): void {
    this.wsClient?.close({ force: true });
    this.wsClient = null;
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async handleIncomingTask(
    event: FeishuIncomingMessageEvent,
    operator: FeishuTaskPayload['operator'],
  ): Promise<void> {
    logger.info('[FeishuService] received message event', {
      senderType: event.sender.sender_type,
      messageType: event.message.message_type,
      messageId: event.message.message_id,
      chatId: event.message.chat_id,
    });

    if (event.sender.sender_type !== 'user') {
      return;
    }

    if (!isSupportedFeishuMessageType(event.message.message_type)) {
      await this.replyToMessage(
        event.message.message_id,
        formatUnsupportedMessageReply(),
      );
      return;
    }

    const instructions = parseFeishuTextContent(event.message.content);
    if (!instructions) {
      logger.warn('[FeishuService] ignored empty text message', {
        messageId: event.message.message_id,
      });
      await this.replyToMessage(
        event.message.message_id,
        formatUnsupportedMessageReply(),
      );
      return;
    }

    if (this.currentTask || store.getState().thinking) {
      await this.replyToMessage(
        event.message.message_id,
        formatFeishuBusyReply(),
      );
      return;
    }

    const task: RunningFeishuTask = {
      taskId: `feishu_${Date.now()}_${event.message.message_id}`,
      instructions,
      operator,
      chatId: event.message.chat_id,
      messageId: event.message.message_id,
      phase: 'starting',
    };

    this.currentTask = task;

    await showWindow();
    await this.replyToMessage(
      event.message.message_id,
      formatFeishuAcceptedReply(operator),
    );
    logger.info('[FeishuService] dispatching task to renderer', {
      taskId: task.taskId,
      operator,
    });
    this.dispatchTaskToRenderer(task);
    void this.startTaskExecution(task);
  }

  private dispatchTaskToRenderer(task: FeishuTaskPayload): void {
    const windows = BrowserWindow.getAllWindows().filter(
      (window) => !window.isDestroyed(),
    );

    if (!windows.length) {
      logger.warn(
        '[FeishuService] skipped renderer sync because no active window exists',
        { taskId: task.taskId },
      );
      return;
    }

    windows.forEach((window) => {
      window.webContents.send(FEISHU_TASK_RECEIVED_CHANNEL, task);
    });
  }

  private async handleAppStateChange(state: AppState): Promise<void> {
    if (!this.currentTask) {
      return;
    }

    if (
      this.currentTask.phase !== 'running' ||
      state.thinking ||
      !isTerminalStatus(state.status) ||
      !this.isStateBoundToTask(state, this.currentTask)
    ) {
      return;
    }

    const finishedTask = this.currentTask;
    const finalState: FeishuTaskFinalState = {
      status: state.status,
      messages: state.messages,
      errorMsg: state.errorMsg,
    };

    this.clearCurrentTask();

    if (finalState.status === StatusEnum.END) {
      await this.replyToMessage(
        finishedTask.messageId,
        formatFeishuSuccessReply(
          finishedTask.instructions,
          extractFinishedMessage(finalState.messages),
        ),
      );
      return;
    }

    const failureMessage =
      finalState.status === StatusEnum.USER_STOPPED
        ? '任务已在软件中被手动停止。'
        : finalState.errorMsg;

    await this.replyToMessage(
      finishedTask.messageId,
      formatFeishuFailureReply(finishedTask.instructions, failureMessage),
    );
  }

  private async startTaskExecution(task: RunningFeishuTask): Promise<void> {
    const runtimeOperator = task.operator as unknown as Operator;
    const initialMessages: Conversation[] = [
      {
        from: 'human',
        value: task.instructions,
        timing: {
          start: Date.now(),
          end: Date.now(),
          cost: 0,
        },
      },
    ];

    SettingStore.set('operator', runtimeOperator);
    store.setState({
      instructions: task.instructions,
      messages: initialMessages,
      sessionHistoryMessages: [],
      abortController: new AbortController(),
      thinking: true,
      errorMsg: null,
      restUserData: null,
      status: StatusEnum.INIT,
    });
    if (this.currentTask?.taskId === task.taskId) {
      this.currentTask.phase = 'running';
    }

    try {
      await runAgent(store.setState, store.getState);
    } catch (error) {
      logger.error('[FeishuService] failed to start task execution:', error);
      store.setState({
        status: StatusEnum.ERROR,
        errorMsg:
          error instanceof Error
            ? error.message
            : 'Failed to start feishu task',
      });
    } finally {
      store.setState({ thinking: false });
    }
  }

  private clearCurrentTask(): void {
    this.currentTask = null;
  }

  private isStateBoundToTask(
    state: AppState,
    task: RunningFeishuTask,
  ): boolean {
    if (state.instructions === task.instructions) {
      return true;
    }

    return state.messages.some(
      (message) =>
        message.from === 'human' && message.value === task.instructions,
    );
  }

  private async replyToMessage(messageId: string, text: string): Promise<void> {
    if (!this.client) {
      logger.warn(
        '[FeishuService] reply skipped because client is unavailable',
      );
      return;
    }

    try {
      await this.client.im.v1.message.reply({
        path: {
          message_id: messageId,
        },
        data: {
          msg_type: FEISHU_MESSAGE_TYPE_TEXT,
          content: buildFeishuTextContent(text),
          uuid: `${messageId}_${Date.now()}`,
        },
      });
    } catch (error) {
      logger.error('[FeishuService] failed to reply message:', error);
    }
  }
}
