/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import crypto from 'node:crypto';

import { logger } from '@main/logger';

import type {
  WeixinGetUpdatesResponse,
  WeixinQrStartResult,
  WeixinQrWaitResult,
} from './types';
import { DEFAULT_WEIXIN_BOT_TYPE } from './utils';

interface ApiFetchParams {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  label: string;
}

interface SendWeixinTextMessageParams {
  baseUrl: string;
  token: string;
  toUserId: string;
  text: string;
  contextToken?: string;
}

interface GetUpdatesParams {
  baseUrl: string;
  token: string;
  getUpdatesBuf?: string;
  timeoutMs?: number;
}

type ActiveLogin = {
  sessionKey: string;
  id: string;
  qrcode: string;
  qrCodeUrl: string;
  startedAt: number;
};

interface QRCodeResponse {
  qrcode: string;
  qrcode_img_content: string;
}

interface StatusResponse {
  status: 'wait' | 'scaned' | 'confirmed' | 'expired';
  bot_token?: string;
  ilink_bot_id?: string;
  baseurl?: string;
  ilink_user_id?: string;
}

const DEFAULT_API_TIMEOUT_MS = 15_000;
const DEFAULT_LONG_POLL_TIMEOUT_MS = 35_000;
const DEFAULT_LOGIN_TIMEOUT_MS = 480_000;
const LOGIN_TTL_MS = 5 * 60_000;
const activeLogins = new Map<string, ActiveLogin>();

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function buildBaseInfo() {
  return {
    channel_version: 'ui-tars-weixin-bridge',
  };
}

function randomWechatUin(): string {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), 'utf-8').toString('base64');
}

function buildRequestHeaders(
  token?: string,
  body?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    AuthorizationType: 'ilink_bot_token',
    'X-WECHAT-UIN': randomWechatUin(),
  };

  if (body != null) {
    headers['Content-Length'] = String(Buffer.byteLength(body, 'utf-8'));
  }

  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  return headers;
}

async function apiFetch(params: ApiFetchParams): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const response = await fetch(params.url, {
      method: params.method ?? 'GET',
      headers: params.headers,
      body: params.body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(
        `${params.label} failed: ${response.status} ${response.statusText} ${rawText}`,
      );
    }

    return rawText;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

function isLoginFresh(login: ActiveLogin): boolean {
  return Date.now() - login.startedAt < LOGIN_TTL_MS;
}

function purgeExpiredLogins(): void {
  for (const [sessionKey, login] of activeLogins.entries()) {
    if (!isLoginFresh(login)) {
      activeLogins.delete(sessionKey);
    }
  }
}

export async function startWeixinQrLogin(params: {
  baseUrl: string;
  sessionKey: string;
  botType?: string;
}): Promise<WeixinQrStartResult> {
  purgeExpiredLogins();

  const existing = activeLogins.get(params.sessionKey);
  if (existing && isLoginFresh(existing)) {
    return {
      qrCodeUrl: existing.qrCodeUrl,
      message: 'QR code is ready. Scan it with WeChat.',
      sessionKey: params.sessionKey,
    };
  }

  const base = ensureTrailingSlash(params.baseUrl);
  const url = new URL(
    `ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(
      params.botType ?? DEFAULT_WEIXIN_BOT_TYPE,
    )}`,
    base,
  );

  const rawText = await apiFetch({
    url: url.toString(),
    timeoutMs: DEFAULT_API_TIMEOUT_MS,
    label: 'get_bot_qrcode',
  });
  const response = JSON.parse(rawText) as QRCodeResponse;

  const login: ActiveLogin = {
    sessionKey: params.sessionKey,
    id: crypto.randomUUID(),
    qrcode: response.qrcode,
    qrCodeUrl: response.qrcode_img_content,
    startedAt: Date.now(),
  };

  activeLogins.set(params.sessionKey, login);

  return {
    qrCodeUrl: response.qrcode_img_content,
    message: '扫描二维码，实现微信聊天来操作电脑。',
    sessionKey: params.sessionKey,
  };
}

export async function waitForWeixinQrLogin(params: {
  sessionKey: string;
  baseUrl: string;
  timeoutMs?: number;
}): Promise<WeixinQrWaitResult> {
  const login = activeLogins.get(params.sessionKey);
  if (!login) {
    return {
      connected: false,
      message: 'No active login session. Start a new QR login first.',
    };
  }

  if (!isLoginFresh(login)) {
    activeLogins.delete(params.sessionKey);
    return {
      connected: false,
      message: 'The QR code has expired. Generate a new one.',
    };
  }

  const deadline =
    Date.now() + Math.max(params.timeoutMs ?? DEFAULT_LOGIN_TIMEOUT_MS, 1000);
  const base = ensureTrailingSlash(params.baseUrl);

  while (Date.now() < deadline) {
    try {
      const url = new URL(
        `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(login.qrcode)}`,
        base,
      );

      const rawText = await apiFetch({
        url: url.toString(),
        timeoutMs: DEFAULT_LONG_POLL_TIMEOUT_MS,
        label: 'get_qrcode_status',
        headers: {
          'iLink-App-ClientVersion': '1',
        },
      });
      const response = JSON.parse(rawText) as StatusResponse;

      if (response.status === 'wait' || response.status === 'scaned') {
        continue;
      }

      if (response.status === 'expired') {
        activeLogins.delete(params.sessionKey);
        return {
          connected: false,
          message: '二维码过期，点击按钮重新获取二维码。',
        };
      }

      if (
        response.status === 'confirmed' &&
        response.bot_token &&
        response.ilink_bot_id
      ) {
        activeLogins.delete(params.sessionKey);
        return {
          connected: true,
          message: 'WeChat account connected.',
          botToken: response.bot_token,
          accountId: response.ilink_bot_id,
          baseUrl: response.baseurl?.trim() || params.baseUrl,
          userId: response.ilink_user_id?.trim() || undefined,
        };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        continue;
      }

      logger.error('[WeixinAPI] waitForWeixinQrLogin failed:', error);
      return {
        connected: false,
        message:
          error instanceof Error
            ? error.message
            : 'WeChat login polling failed.',
      };
    }
  }

  activeLogins.delete(params.sessionKey);
  return {
    connected: false,
    message: 'Timed out while waiting for WeChat confirmation.',
  };
}

export async function getWeixinUpdates(
  params: GetUpdatesParams,
): Promise<WeixinGetUpdatesResponse> {
  const base = ensureTrailingSlash(params.baseUrl);
  const url = new URL('ilink/bot/getupdates', base);
  const body = JSON.stringify({
    get_updates_buf: params.getUpdatesBuf ?? '',
    base_info: buildBaseInfo(),
  });

  try {
    const rawText = await apiFetch({
      url: url.toString(),
      method: 'POST',
      body,
      headers: buildRequestHeaders(params.token, body),
      timeoutMs: params.timeoutMs ?? DEFAULT_LONG_POLL_TIMEOUT_MS,
      label: 'getupdates',
    });

    return JSON.parse(rawText) as WeixinGetUpdatesResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ret: 0,
        msgs: [],
        get_updates_buf: params.getUpdatesBuf ?? '',
      };
    }

    throw error;
  }
}

export async function sendWeixinTextMessage(
  params: SendWeixinTextMessageParams,
): Promise<void> {
  const base = ensureTrailingSlash(params.baseUrl);
  const url = new URL('ilink/bot/sendmessage', base);
  const clientId = `uitars_${Date.now()}_${crypto.randomUUID()}`;
  const body = JSON.stringify({
    msg: {
      from_user_id: '',
      to_user_id: params.toUserId,
      client_id: clientId,
      message_type: 2,
      message_state: 2,
      item_list: [
        {
          type: 1,
          text_item: {
            text: params.text,
          },
        },
      ],
      context_token: params.contextToken,
    },
    base_info: buildBaseInfo(),
  });

  await apiFetch({
    url: url.toString(),
    method: 'POST',
    body,
    headers: buildRequestHeaders(params.token, body),
    timeoutMs: DEFAULT_API_TIMEOUT_MS,
    label: 'sendmessage',
  });
}
