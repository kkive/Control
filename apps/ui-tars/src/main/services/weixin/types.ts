/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ConversationWithSoM } from '@main/shared/types';
import type { WeixinTaskOperator } from '@main/store/types';
import type { StatusEnum } from '@ui-tars/shared/types';

export const WEIXIN_TASK_RECEIVED_CHANNEL = 'weixin:task-received';
export const WEIXIN_STATUS_UPDATED_CHANNEL = 'weixin:status-updated';

export interface WeixinServiceConfig {
  enabled: boolean;
  operator: WeixinTaskOperator;
}

export interface WeixinConnectedAccount {
  accountId: string;
  userId?: string;
  baseUrl: string;
  connectedAt: number;
}

export interface WeixinLoginSession {
  sessionKey: string;
  qrCodeUrl?: string;
  message: string;
  startedAt: number;
}

export interface WeixinServiceStatus {
  enabled: boolean;
  monitoring: boolean;
  loginPending: boolean;
  qrCodeUrl?: string;
  qrCodeMessage?: string;
  accountCount: number;
  accounts: WeixinConnectedAccount[];
  lastError: string | null;
}

export interface WeixinTaskPayload {
  taskId: string;
  instructions: string;
  operator: WeixinTaskOperator;
  accountId: string;
  fromUserId: string;
  contextToken?: string;
  messageId: string;
}

export interface RunningWeixinTask extends WeixinTaskPayload {
  phase: 'starting' | 'running';
}

export interface WeixinTaskFinalState {
  status: StatusEnum;
  messages: ConversationWithSoM[];
  errorMsg: string | null;
}

export interface WeixinAccountStoreItem {
  accountId: string;
  token: string;
  baseUrl: string;
  userId?: string;
  connectedAt: number;
}

export interface WeixinQrStartResult {
  qrCodeUrl?: string;
  message: string;
  sessionKey: string;
}

export interface WeixinQrWaitResult {
  connected: boolean;
  message: string;
  botToken?: string;
  accountId?: string;
  baseUrl?: string;
  userId?: string;
}

export interface WeixinMessageTextItem {
  text?: string;
}

export interface WeixinMessageVoiceItem {
  text?: string;
}

export interface WeixinMessageItem {
  type: number;
  text_item?: WeixinMessageTextItem;
  voice_item?: WeixinMessageVoiceItem;
}

export interface WeixinInboundMessage {
  message_id?: number;
  from_user_id?: string;
  to_user_id?: string;
  create_time_ms?: number;
  context_token?: string;
  item_list?: WeixinMessageItem[];
  message_type?: number;
  message_state?: number;
}

export interface WeixinGetUpdatesResponse {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  msgs?: WeixinInboundMessage[];
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
}
