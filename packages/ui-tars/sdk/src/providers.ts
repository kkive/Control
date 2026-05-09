/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ClientOptions } from 'openai';

export const XIAOMI_MIMO_BASE_URL =
  'https://token-plan-cn.xiaomimimo.com/v1';
export const XIAOMI_MIMO_DEFAULT_MODEL = 'mimo-v2.5';

/**
 * Normalize a base URL by stripping a trailing `/chat/completions` so users can
 * paste the full curl endpoint directly.
 */
export function normalizeBaseURL(url: string): string {
  return url.replace(/\/chat\/completions\/?$/, '');
}

/**
 * Detect whether a given base URL points to the Xiaomi MiMo API.
 */
export function isXiaomiProvider(baseURL?: string): boolean {
  if (!baseURL) return false;
  return /xiaomimimo\.com/i.test(baseURL);
}

export function isXiaomiTokenPlanProvider(baseURL?: string): boolean {
  if (!baseURL) return false;
  return /\/\/token-plan-[^.]+\.xiaomimimo\.com/i.test(baseURL);
}

/**
 * Build OpenAI ClientOptions suitable for Xiaomi MiMo.
 *
 * Standard MiMo uses `api-key`, while Token Plan endpoints use the standard
 * OpenAI-compatible `Authorization: Bearer ...` header.
 */
export function buildXiaomiClientOptions(
  apiKey: string,
  baseURL: string,
  extra?: Partial<ClientOptions>,
): ClientOptions {
  const normalizedBaseURL = normalizeBaseURL(baseURL);
  const defaultHeaders = extra?.defaultHeaders as
    | Record<string, string | null | undefined>
    | undefined;
  if (isXiaomiTokenPlanProvider(normalizedBaseURL)) {
    return {
      ...extra,
      apiKey: apiKey || 'placeholder',
      baseURL: normalizedBaseURL,
      defaultHeaders,
    };
  }

  return {
    ...extra,
    apiKey: apiKey || 'placeholder',
    baseURL: normalizedBaseURL,
    defaultHeaders: {
      ...defaultHeaders,
      Authorization: null,
      'api-key': apiKey,
    },
  };
}
