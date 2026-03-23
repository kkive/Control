/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';

import { FeishuTaskOperator } from '@main/store/types';

import {
  buildFeishuTextContent,
  extractFinishedMessage,
  formatFeishuAcceptedReply,
  formatFeishuFailureReply,
  formatFeishuSuccessReply,
  getFeishuServiceConfig,
  hasFeishuCredentials,
  parseFeishuTextContent,
} from './utils';

describe('feishu utils', () => {
  it('parses text content from feishu payload', () => {
    expect(parseFeishuTextContent('{"text":"整理今日日报"}')).toBe(
      '整理今日日报',
    );
  });

  it('builds text content in feishu format', () => {
    expect(buildFeishuTextContent('hello')).toBe('{"text":"hello"}');
  });

  it('extracts finished content from agent messages', () => {
    expect(
      extractFinishedMessage([
        {
          from: 'gpt',
          value: '',
          predictionParsed: [
            {
              action_type: 'finished',
              action_inputs: {
                content: '任务已完成',
              },
              reflection: null,
              thought: 'wrap up',
            },
          ],
        },
      ]),
    ).toBe('任务已完成');
  });

  it('builds a runnable feishu config from settings', () => {
    const config = getFeishuServiceConfig({
      feishuEnabled: true,
      feishuAppId: ' cli_123 ',
      feishuAppSecret: ' secret_123 ',
      feishuTaskOperator: FeishuTaskOperator.LocalBrowser,
    });

    expect(config).toEqual({
      enabled: true,
      appId: 'cli_123',
      appSecret: 'secret_123',
      operator: FeishuTaskOperator.LocalBrowser,
    });
    expect(hasFeishuCredentials(config)).toBe(true);
  });

  it('formats success and failure replies', () => {
    expect(
      formatFeishuAcceptedReply(FeishuTaskOperator.LocalComputer),
    ).toContain('本地电脑');
    expect(formatFeishuSuccessReply('打开浏览器', '已打开浏览器')).toContain(
      '已完成',
    );
    expect(
      formatFeishuFailureReply('打开浏览器', '{"message":"缺少屏幕控制权限"}'),
    ).toContain('缺少屏幕控制权限');
  });
});
