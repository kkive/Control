/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { BrowserWindow, app, ipcMain } from 'electron';

import { logger } from '@main/logger';
import { runAgent } from '@main/services/runAgent';
import { store } from '@main/store/create';
import { SettingStore } from '@main/store/setting';
import { type AppState, Operator } from '@main/store/types';
import { showWindow } from '@main/window';
import { Conversation, StatusEnum } from '@ui-tars/shared/types';

import {
  getWeixinUpdates,
  sendWeixinTextMessage,
  startWeixinQrLogin,
  waitForWeixinQrLogin,
} from './api';
import {
  WEIXIN_STATUS_UPDATED_CHANNEL,
  WEIXIN_TASK_RECEIVED_CHANNEL,
  type RunningWeixinTask,
  type WeixinAccountStoreItem,
  type WeixinConnectedAccount,
  type WeixinInboundMessage,
  type WeixinLoginSession,
  type WeixinServiceStatus,
  type WeixinTaskFinalState,
  type WeixinTaskPayload,
} from './types';
import {
  DEFAULT_WEIXIN_BASE_URL,
  extractFinishedMessage,
  extractWeixinTextContent,
  formatUnsupportedMessageReply,
  formatWeixinAcceptedReply,
  formatWeixinBusyReply,
  formatWeixinFailureReply,
  formatWeixinSuccessReply,
  getWeixinConfigSignature,
  getWeixinServiceConfig,
  hasWeixinEnabled,
  isTerminalStatus,
} from './utils';

const ACCOUNTS_FILE_NAME = 'accounts.json';
const SYNC_DIR_NAME = 'sync';

export class WeixinService {
  private static instance: WeixinService;

  private settingsUnsubscribe: (() => void) | null = null;
  private storeUnsubscribe: (() => void) | null = null;
  private currentConfigSignature: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private currentTask: RunningWeixinTask | null = null;
  private loginSession: WeixinLoginSession | null = null;
  private lastError: string | null = null;
  private ipcHandlersRegistered = false;
  private monitorControllers = new Map<string, AbortController>();

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): WeixinService {
    if (!WeixinService.instance) {
      WeixinService.instance = new WeixinService();
    }

    return WeixinService.instance;
  }

  public initialize(): void {
    if (!this.ipcHandlersRegistered) {
      this.registerIpcHandlers();
      this.ipcHandlersRegistered = true;
    }

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

    this.clearRefreshTimer();
    this.stopAllMonitors();
    this.clearCurrentTask();
    this.loginSession = null;
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('weixin:getStatus', async () => this.getStatus());
    ipcMain.handle('weixin:startLogin', async () => this.startLogin());
    ipcMain.handle('weixin:deleteAccount', async (_event, accountId: string) =>
      this.deleteAccount(accountId),
    );
  }

  private scheduleRefreshFromSettings(delayMs = 800): void {
    this.clearRefreshTimer();
    this.refreshTimer = setTimeout(() => {
      void this.refreshFromSettings();
    }, delayMs);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async refreshFromSettings(): Promise<void> {
    this.refreshTimer = null;

    const config = getWeixinServiceConfig(SettingStore.getStore());
    const nextSignature = getWeixinConfigSignature(config);

    if (this.currentConfigSignature === nextSignature) {
      return;
    }

    this.currentConfigSignature = nextSignature;

    if (!hasWeixinEnabled(config)) {
      this.stopAllMonitors();
      this.emitStatus();
      return;
    }

    this.reconcileMonitors();
    this.emitStatus();
  }

  private reconcileMonitors(): void {
    const accounts = this.loadAccounts();
    const enabledAccountIds = new Set(accounts.map((account) => account.accountId));

    for (const [accountId, controller] of this.monitorControllers.entries()) {
      if (!enabledAccountIds.has(accountId)) {
        controller.abort();
        this.monitorControllers.delete(accountId);
      }
    }

    for (const account of accounts) {
      if (!this.monitorControllers.has(account.accountId)) {
        this.startMonitor(account);
      }
    }
  }

  private stopAllMonitors(): void {
    for (const controller of this.monitorControllers.values()) {
      controller.abort();
    }

    this.monitorControllers.clear();
  }

  private startMonitor(account: WeixinAccountStoreItem): void {
    const controller = new AbortController();
    this.monitorControllers.set(account.accountId, controller);

    void this.monitorAccount(account, controller.signal)
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        this.lastError =
          error instanceof Error ? error.message : 'WeChat monitor failed.';
        logger.error('[WeixinService] monitorAccount failed:', error);
        this.scheduleRefreshFromSettings(5_000);
      })
      .finally(() => {
        if (this.monitorControllers.get(account.accountId) === controller) {
          this.monitorControllers.delete(account.accountId);
          this.emitStatus();
        }
      });
  }

  private async monitorAccount(
    account: WeixinAccountStoreItem,
    signal: AbortSignal,
  ): Promise<void> {
    let syncBuf = this.loadSyncBuffer(account.accountId);
    let timeoutMs = 35_000;

    logger.info('[WeixinService] monitor started', {
      accountId: account.accountId,
      baseUrl: account.baseUrl,
    });

    while (!signal.aborted) {
      const response = await getWeixinUpdates({
        baseUrl: account.baseUrl,
        token: account.token,
        getUpdatesBuf: syncBuf,
        timeoutMs,
      });

      if (signal.aborted) {
        break;
      }

      if (response.longpolling_timeout_ms) {
        timeoutMs = response.longpolling_timeout_ms;
      }

      const isApiError =
        (response.ret !== undefined && response.ret !== 0) ||
        (response.errcode !== undefined && response.errcode !== 0);

      if (isApiError) {
        throw new Error(
          `WeChat getupdates failed: ${response.errcode ?? response.ret} ${response.errmsg ?? ''}`.trim(),
        );
      }

      if (response.get_updates_buf) {
        syncBuf = response.get_updates_buf;
        this.saveSyncBuffer(account.accountId, syncBuf);
      }

      for (const message of response.msgs ?? []) {
        await this.handleIncomingTask(account, message);
      }
    }
  }

  private async handleIncomingTask(
    account: WeixinAccountStoreItem,
    message: WeixinInboundMessage,
  ): Promise<void> {
    logger.info('[WeixinService] received message', {
      accountId: account.accountId,
      fromUserId: message.from_user_id,
      messageId: message.message_id,
      messageType: message.message_type,
      messageState: message.message_state,
    });

    const fromUserId = message.from_user_id?.trim();
    if (!fromUserId) {
      logger.warn('[WeixinService] skipped message without sender', {
        accountId: account.accountId,
        messageId: message.message_id,
      });
      return;
    }

    const instructions = extractWeixinTextContent(message.item_list);
    if (!instructions) {
      await this.replyToMessage(
        account,
        fromUserId,
        message.context_token,
        formatUnsupportedMessageReply(),
      );
      return;
    }

    if (this.currentTask || store.getState().thinking) {
      await this.replyToMessage(
        account,
        fromUserId,
        message.context_token,
        formatWeixinBusyReply(),
      );
      return;
    }

    const operator = getWeixinServiceConfig(SettingStore.getStore()).operator;
    const task: RunningWeixinTask = {
      taskId: `weixin_${Date.now()}_${String(message.message_id ?? crypto.randomUUID())}`,
      instructions,
      operator,
      accountId: account.accountId,
      fromUserId,
      contextToken: message.context_token,
      messageId: String(message.message_id ?? Date.now()),
      phase: 'starting',
    };

    this.currentTask = task;

    try {
      await showWindow();
    } catch (error) {
      logger.error('[WeixinService] failed to show window before task start:', error);
    }

    this.dispatchTaskToRenderer(task);

    void this.replyToMessage(
      account,
      task.fromUserId,
      task.contextToken,
      formatWeixinAcceptedReply(operator),
    );

    void this.startTaskExecution(task).catch((error) => {
      logger.error('[WeixinService] task execution crashed:', error);
      if (this.currentTask?.taskId === task.taskId) {
        this.clearCurrentTask();
        this.emitStatus();
      }
    });
  }

  private dispatchTaskToRenderer(task: WeixinTaskPayload): void {
    const windows = BrowserWindow.getAllWindows().filter(
      (window) => !window.isDestroyed(),
    );

    if (!windows.length) {
      logger.warn(
        '[WeixinService] skipped renderer sync because no active window exists',
        { taskId: task.taskId },
      );
      return;
    }

    windows.forEach((window) => {
      window.webContents.send(WEIXIN_TASK_RECEIVED_CHANNEL, task);
    });
  }

  private async startTaskExecution(task: RunningWeixinTask): Promise<void> {
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
      logger.error('[WeixinService] failed to start task execution:', error);
      store.setState({
        status: StatusEnum.ERROR,
        errorMsg:
          error instanceof Error
            ? error.message
            : 'Failed to start WeChat task',
      });
    } finally {
      store.setState({ thinking: false });
    }
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
    const finalState: WeixinTaskFinalState = {
      status: state.status,
      messages: state.messages,
      errorMsg: state.errorMsg,
    };

    this.clearCurrentTask();

    const account = this.loadAccount(finishedTask.accountId);
    if (!account) {
      return;
    }

    if (finalState.status === StatusEnum.END) {
      await this.replyToMessage(
        account,
        finishedTask.fromUserId,
        finishedTask.contextToken,
        formatWeixinSuccessReply(
          finishedTask.instructions,
          extractFinishedMessage(finalState.messages),
        ),
      );
      return;
    }

    const failureMessage =
      finalState.status === StatusEnum.USER_STOPPED
        ? 'The task was stopped manually inside the desktop app.'
        : finalState.errorMsg;

    await this.replyToMessage(
      account,
      finishedTask.fromUserId,
      finishedTask.contextToken,
      formatWeixinFailureReply(finishedTask.instructions, failureMessage),
    );
  }

  private async replyToMessage(
    account: WeixinAccountStoreItem,
    toUserId: string,
    contextToken: string | undefined,
    text: string,
  ): Promise<void> {
    try {
      await sendWeixinTextMessage({
        baseUrl: account.baseUrl,
        token: account.token,
        toUserId,
        text,
        contextToken,
      });
    } catch (error) {
      logger.error('[WeixinService] failed to reply message:', error);
      this.lastError =
        error instanceof Error ? error.message : 'Failed to send WeChat reply.';
      this.emitStatus();
    }
  }

  private clearCurrentTask(): void {
    this.currentTask = null;
  }

  private isStateBoundToTask(
    state: AppState,
    task: RunningWeixinTask,
  ): boolean {
    if (state.instructions === task.instructions) {
      return true;
    }

    return state.messages.some(
      (message) =>
        message.from === 'human' && message.value === task.instructions,
    );
  }

  private async startLogin() {
    const sessionKey = crypto.randomUUID();
    const startResult = await startWeixinQrLogin({
      baseUrl: DEFAULT_WEIXIN_BASE_URL,
      sessionKey,
    });

    this.loginSession = {
      sessionKey,
      qrCodeUrl: startResult.qrCodeUrl,
      message: startResult.message,
      startedAt: Date.now(),
    };
    this.lastError = null;
    this.emitStatus();

    void this.waitForLogin(sessionKey);

    return startResult;
  }

  private async waitForLogin(sessionKey: string): Promise<void> {
    const waitResult = await waitForWeixinQrLogin({
      sessionKey,
      baseUrl: DEFAULT_WEIXIN_BASE_URL,
    });

    this.loginSession = null;

    if (
      waitResult.connected &&
      waitResult.botToken &&
      waitResult.accountId &&
      waitResult.baseUrl
    ) {
      this.saveAccount({
        accountId: waitResult.accountId,
        token: waitResult.botToken,
        baseUrl: waitResult.baseUrl,
        userId: waitResult.userId,
        connectedAt: Date.now(),
      });
      this.lastError = null;
      if (hasWeixinEnabled(getWeixinServiceConfig(SettingStore.getStore()))) {
        this.reconcileMonitors();
      }
    } else {
      this.lastError = waitResult.message;
    }

    this.emitStatus();
  }

  private getStatus(): WeixinServiceStatus {
    const config = getWeixinServiceConfig(SettingStore.getStore());
    const accounts = this.loadAccounts();

    return {
      enabled: config.enabled,
      monitoring: this.monitorControllers.size > 0,
      loginPending: Boolean(this.loginSession),
      qrCodeUrl: this.loginSession?.qrCodeUrl,
      qrCodeMessage: this.loginSession?.message,
      accountCount: accounts.length,
      accounts: accounts.map<WeixinConnectedAccount>((account) => ({
        accountId: account.accountId,
        userId: account.userId,
        baseUrl: account.baseUrl,
        connectedAt: account.connectedAt,
      })),
      lastError: this.lastError,
    };
  }

  private emitStatus(): void {
    const status = this.getStatus();
    BrowserWindow.getAllWindows()
      .filter((window) => !window.isDestroyed())
      .forEach((window) => {
        window.webContents.send(WEIXIN_STATUS_UPDATED_CHANNEL, status);
      });
  }

  private getStateDir(): string {
    const stateDir = path.join(app.getPath('userData'), 'weixin-openclaw');
    fs.mkdirSync(stateDir, { recursive: true });
    return stateDir;
  }

  private getAccountsPath(): string {
    return path.join(this.getStateDir(), ACCOUNTS_FILE_NAME);
  }

  private getSyncDir(): string {
    const syncDir = path.join(this.getStateDir(), SYNC_DIR_NAME);
    fs.mkdirSync(syncDir, { recursive: true });
    return syncDir;
  }

  private getSyncPath(accountId: string): string {
    return path.join(this.getSyncDir(), `${this.normalizeAccountId(accountId)}.sync`);
  }

  private normalizeAccountId(accountId: string): string {
    return accountId.replace(/[^a-zA-Z0-9._-]/g, '-');
  }

  private loadAccounts(): WeixinAccountStoreItem[] {
    const filePath = this.getAccountsPath();
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const rawText = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(rawText);
      return Array.isArray(parsed)
        ? parsed.filter(
            (item): item is WeixinAccountStoreItem =>
              Boolean(
                item &&
                  typeof item.accountId === 'string' &&
                  typeof item.token === 'string' &&
                  typeof item.baseUrl === 'string',
              ),
          )
        : [];
    } catch (error) {
      logger.error('[WeixinService] failed to load accounts:', error);
      return [];
    }
  }

  private loadAccount(accountId: string): WeixinAccountStoreItem | null {
    return this.loadAccounts().find((item) => item.accountId === accountId) ?? null;
  }

  private saveAccount(account: WeixinAccountStoreItem): void {
    const accounts = this.loadAccounts();
    const accountIndex = accounts.findIndex(
      (item) =>
        item.accountId === account.accountId ||
        (account.userId && item.userId === account.userId),
    );

    if (accountIndex >= 0) {
      accounts[accountIndex] = account;
    } else {
      accounts.push(account);
    }

    fs.writeFileSync(
      this.getAccountsPath(),
      JSON.stringify(accounts, null, 2),
      'utf-8',
    );
  }

  private deleteAccountSync(accountId: string): boolean {
    const accounts = this.loadAccounts();
    const nextAccounts = accounts.filter(
      (account) => account.accountId !== accountId,
    );

    if (nextAccounts.length === accounts.length) {
      return false;
    }

    if (nextAccounts.length > 0) {
      fs.writeFileSync(
        this.getAccountsPath(),
        JSON.stringify(nextAccounts, null, 2),
        'utf-8',
      );
    } else if (fs.existsSync(this.getAccountsPath())) {
      fs.unlinkSync(this.getAccountsPath());
    }

    const syncPath = this.getSyncPath(accountId);
    if (fs.existsSync(syncPath)) {
      fs.unlinkSync(syncPath);
    }

    return true;
  }

  private async deleteAccount(accountId: string): Promise<boolean> {
    const deleted = this.deleteAccountSync(accountId);

    if (!deleted) {
      return false;
    }

    const monitor = this.monitorControllers.get(accountId);
    if (monitor) {
      monitor.abort();
      this.monitorControllers.delete(accountId);
    }

    if (this.currentTask?.accountId === accountId) {
      store.getState().abortController?.abort();
      this.clearCurrentTask();
      store.setState({
        thinking: false,
        status: StatusEnum.END,
      });
    }

    this.lastError = null;
    this.emitStatus();
    return true;
  }

  private loadSyncBuffer(accountId: string): string {
    const filePath = this.getSyncPath(accountId);
    if (!fs.existsSync(filePath)) {
      return '';
    }

    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      logger.error('[WeixinService] failed to load sync buffer:', error);
      return '';
    }
  }

  private saveSyncBuffer(accountId: string, value: string): void {
    try {
      fs.writeFileSync(this.getSyncPath(accountId), value, 'utf-8');
    } catch (error) {
      logger.error('[WeixinService] failed to save sync buffer:', error);
    }
  }
}
