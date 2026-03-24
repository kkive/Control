/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { ConversationWithSoM } from '@main/shared/types';
import { WeixinTaskOperator } from '@main/store/types';
import type { LocalStore } from '@main/store/validate';
import { StatusEnum } from '@ui-tars/shared/types';

import type { WeixinMessageItem, WeixinServiceConfig } from './types';

const MAX_REPLY_LENGTH = 1200;

export const DEFAULT_WEIXIN_BASE_URL = 'https://ilinkai.weixin.qq.com';
export const DEFAULT_WEIXIN_BOT_TYPE = '3';
export const WEIXIN_TEXT_ITEM_TYPE = 1;
export const WEIXIN_VOICE_ITEM_TYPE = 3;
export const WEIXIN_MESSAGE_TYPE_USER = 1;
export const WEIXIN_MESSAGE_STATE_NEW = 0;

export function getWeixinServiceConfig(
  settings: Partial<LocalStore>,
): WeixinServiceConfig {
  return {
    enabled: Boolean(settings.weixinEnabled),
    operator: settings.weixinTaskOperator ?? WeixinTaskOperator.LocalComputer,
  };
}

export function hasWeixinEnabled(config: WeixinServiceConfig): boolean {
  return Boolean(config.enabled);
}

export function getWeixinConfigSignature(config: WeixinServiceConfig): string {
  return JSON.stringify(config);
}

export function extractWeixinTextContent(
  itemList?: WeixinMessageItem[],
): string {
  if (!itemList?.length) {
    return '';
  }

  for (const item of itemList) {
    if (
      item.type === WEIXIN_TEXT_ITEM_TYPE &&
      typeof item.text_item?.text === 'string'
    ) {
      return item.text_item.text.trim();
    }

    if (
      item.type === WEIXIN_VOICE_ITEM_TYPE &&
      typeof item.voice_item?.text === 'string'
    ) {
      return item.voice_item.text.trim();
    }
  }

  return '';
}

export function isTerminalStatus(status: StatusEnum): boolean {
  return (
    status === StatusEnum.END ||
    status === StatusEnum.ERROR ||
    status === StatusEnum.USER_STOPPED
  );
}

export function getWeixinOperatorLabel(operator: WeixinTaskOperator): string {
  return operator === WeixinTaskOperator.LocalBrowser
    ? 'local browser'
    : 'local computer';
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

export function formatWeixinAcceptedReply(
  operator: WeixinTaskOperator,
): string {
  return truncateReplyText(
    `已收到。该应用程序现在正在执行此任务 ${getWeixinOperatorLabel(operator)}.`,
  );
}

export function formatWeixinBusyReply(): string {
  return 'The app is busy with another task. Please send the next instruction later.';
}

export function formatUnsupportedMessageReply(): string {
  return 'Only plain text task instructions are supported right now.';
}

export function formatWeixinSuccessReply(
  instructions: string,
  result: string | null,
): string {
  const normalizedResult = result?.trim();

  return truncateReplyText(
    normalizedResult
      ? `任务已完成。\n指令: ${instructions}\n结果: ${normalizedResult}`
      : `任务已完成。\n指令: ${instructions}\n结果: 请查看桌面应用程序以获取详细的执行跟踪信息。`,
  );
}

export function formatWeixinFailureReply(
  instructions: string,
  errorMsg: string | null,
): string {
  return truncateReplyText(
    `Task failed.\nInstruction: ${instructions}\nReason: ${normalizeErrorMessage(errorMsg)}`,
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
    return 'Check model settings, permissions, or the local runtime environment.';
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

  return (
    errorMsg.trim() ||
    'Check model settings, permissions, or the local runtime environment.'
  );
}
