/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ConversationWithSoM } from '@main/shared/types';
import type { FeishuTaskOperator } from '@main/store/types';
import type { StatusEnum } from '@ui-tars/shared/types';

export const FEISHU_TASK_RECEIVED_CHANNEL = 'feishu:task-received';

export interface FeishuServiceConfig {
  enabled: boolean;
  appId: string;
  appSecret: string;
  operator: FeishuTaskOperator;
}

export interface FeishuTaskPayload {
  taskId: string;
  instructions: string;
  operator: FeishuTaskOperator;
  chatId: string;
  messageId: string;
}

export interface RunningFeishuTask extends FeishuTaskPayload {
  phase: 'starting' | 'running';
}

export interface FeishuTaskFinalState {
  status: StatusEnum;
  messages: ConversationWithSoM[];
  errorMsg: string | null;
}

export interface FeishuIncomingMessageEvent {
  sender: {
    sender_type: string;
  };
  message: {
    message_id: string;
    chat_id: string;
    message_type: string;
    content: string;
  };
}
