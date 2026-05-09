/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { OpenAI } from 'openai';
import type { ClientOptions } from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import { initIpc } from '@ui-tars/electron-ipc/main';
import { logger } from '../logger';

const t = initIpc.create();

function normalizeXiaomiBaseURL(baseUrl: string): string {
  return baseUrl.replace(/\/chat\/completions\/?$/, '');
}

function isXiaomiProvider(baseUrl?: string): boolean {
  return Boolean(baseUrl && /xiaomimimo\.com/i.test(baseUrl));
}

function isXiaomiTokenPlanProvider(baseUrl?: string): boolean {
  return Boolean(
    baseUrl && /\/\/token-plan-[^.]+\.xiaomimimo\.com/i.test(baseUrl),
  );
}

function buildXiaomiClientOptions(
  apiKey: string,
  baseURL: string,
): ClientOptions {
  const normalizedBaseURL = normalizeXiaomiBaseURL(baseURL);
  if (isXiaomiTokenPlanProvider(normalizedBaseURL)) {
    return {
      apiKey: apiKey || 'placeholder',
      baseURL: normalizedBaseURL,
    };
  }

  return {
    apiKey: apiKey || 'placeholder',
    baseURL: normalizedBaseURL,
    defaultHeaders: {
      Authorization: null,
      'api-key': apiKey,
    },
  };
}

export const settingRoute = t.router({
  checkVLMResponseApiSupport: t.procedure
    .input<{
      baseUrl: string;
      apiKey: string;
      modelName: string;
    }>()
    .handle(async ({ input }) => {
      if (isXiaomiProvider(input.baseUrl)) {
        logger.info(
          '[checkVLMResponseApiSupport] Xiaomi MiMo does not support Responses API',
        );
        return false;
      }
      try {
        const openai = new OpenAI({
          apiKey: input.apiKey,
          baseURL: input.baseUrl,
        });
        const result = await openai.responses.create({
          model: input.modelName,
          input: 'return 1+1=?',
          stream: false,
        });
        console.log('result', result);
        return Boolean(result?.id || result?.previous_response_id);
      } catch (e) {
        logger.warn('[checkVLMResponseApiSupport] failed:', e);
        return false;
      }
    }),
  checkModelAvailability: t.procedure
    .input<{
      baseUrl: string;
      apiKey: string;
      modelName: string;
    }>()
    .handle(async ({ input }) => {
      const xiaomi = isXiaomiProvider(input.baseUrl);
      const clientOptions = xiaomi
        ? buildXiaomiClientOptions(input.apiKey, input.baseUrl)
        : { apiKey: input.apiKey, baseURL: input.baseUrl };
      try {
        const openai = new OpenAI(clientOptions);
        const createParams: ChatCompletionCreateParamsNonStreaming = {
          model: input.modelName,
          messages: [{ role: 'user', content: 'return 1+1=?' }],
          stream: false,
        };
        if (xiaomi) {
          createParams.max_completion_tokens = 64;
        }
        const completion =
          await openai.chat.completions.create(createParams);
        console.log('result', completion);

        return Boolean(completion?.id || completion.choices[0].message.content);
      } catch (e) {
        throw e;
      }
    }),
});
