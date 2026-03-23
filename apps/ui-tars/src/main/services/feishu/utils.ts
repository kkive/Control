/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { ConversationWithSoM } from '@main/shared/types';
import { FeishuTaskOperator } from '@main/store/types';
import type { LocalStore } from '@main/store/validate';
import { StatusEnum } from '@ui-tars/shared/types';

import type { FeishuServiceConfig } from './types';

const MAX_REPLY_LENGTH = 1200;

export function getFeishuServiceConfig(
  settings: Partial<LocalStore>,
): FeishuServiceConfig {
  return {
    enabled: Boolean(settings.feishuEnabled),
    appId: settings.feishuAppId?.trim() ?? '',
    appSecret: settings.feishuAppSecret?.trim() ?? '',
    operator: settings.feishuTaskOperator ?? FeishuTaskOperator.LocalComputer,
  };
}

export function hasFeishuCredentials(config: FeishuServiceConfig): boolean {
  return Boolean(config.enabled && config.appId && config.appSecret);
}

export function getFeishuConfigSignature(config: FeishuServiceConfig): string {
  return JSON.stringify(config);
}

export function parseFeishuTextContent(content: string): string {
  try {
    const parsed = JSON.parse(content) as { text?: string };
    return typeof parsed.text === 'string' ? parsed.text.trim() : '';
  } catch {
    return '';
  }
}

export function buildFeishuTextContent(text: string): string {
  return JSON.stringify({ text });
}

export function extractFinishedMessage(
  messages: ConversationWithSoM[],
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.from !== 'gpt' || !message.predictionParsed?.length) {
      continue;
    }

    const finishedStep = message.predictionParsed.find(
      (step) =>
        step.action_type === 'finished' &&
        typeof step.action_inputs?.content === 'string' &&
        step.action_inputs.content.trim() !== '',
    );

    if (finishedStep?.action_inputs?.content) {
      return finishedStep.action_inputs.content.trim();
    }
  }

  return null;
}

export function isTerminalStatus(status: StatusEnum): boolean {
  return (
    status === StatusEnum.END ||
    status === StatusEnum.ERROR ||
    status === StatusEnum.USER_STOPPED
  );
}

export function isSupportedFeishuMessageType(messageType: string): boolean {
  return messageType === 'text';
}

export function getFeishuOperatorLabel(operator: FeishuTaskOperator): string {
  return operator === FeishuTaskOperator.LocalBrowser
    ? '本地浏览器'
    : '本地电脑';
}

export function formatFeishuAcceptedReply(
  operator: FeishuTaskOperator,
): string {
  return truncateReplyText(
    `已收到需求，软件开始通过${getFeishuOperatorLabel(operator)}执行任务。`,
  );
}

export function formatFeishuBusyReply(): string {
  return '软件正在处理上一条飞书需求，请稍后再发新的任务。';
}

export function formatUnsupportedMessageReply(): string {
  return '当前只支持发送文本消息作为任务需求。';
}

export function formatDispatchFailureReply(instructions: string): string {
  return truncateReplyText(
    `任务启动失败。\n需求：${instructions}\n原因：软件未能启动执行流程，请检查模型配置和桌面控制权限。`,
  );
}

export function formatFeishuSuccessReply(
  instructions: string,
  result: string | null,
): string {
  const normalizedResult = result?.trim();

  return truncateReplyText(
    normalizedResult
      ? `任务已完成。\n需求：${instructions}\n结果：${normalizedResult}`
      : `任务已完成。\n需求：${instructions}\n结果：已执行完成，请打开软件界面查看详细过程。`,
  );
}

export function formatFeishuFailureReply(
  instructions: string,
  errorMsg: string | null,
): string {
  return truncateReplyText(
    `任务执行失败。\n需求：${instructions}\n原因：${normalizeErrorMessage(errorMsg)}`,
  );
}

export function truncateReplyText(
  text: string,
  maxLength = MAX_REPLY_LENGTH,
): string {
  const normalizedText = text.replace(/\r/g, '').trim();
  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, maxLength - 3)}...`;
}

function normalizeErrorMessage(errorMsg: string | null): string {
  if (!errorMsg) {
    return '请打开软件检查模型配置、系统权限或运行环境。';
  }

  try {
    const parsed = JSON.parse(errorMsg) as {
      message?: string;
      errorMsg?: string;
    };

    const normalizedMessage = parsed.message ?? parsed.errorMsg;
    if (typeof normalizedMessage === 'string' && normalizedMessage.trim()) {
      return normalizedMessage.trim();
    }
  } catch {
    // Fall through to the raw string below.
  }

  return errorMsg.trim() || '请打开软件检查模型配置、系统权限或运行环境。';
}
