/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Operator } from '@main/store/types';

export const COMPUTER_OPERATOR = 'Computer Operator';
export const BROWSER_OPERATOR = 'Browser Operator';

export const OPERATOR_URL_MAP = {
  [Operator.RemoteComputer]: {
    text: 'If you need to use it for a long-term and stable period, you can log in to the Volcano Engine FaaS to experience the Online Computer Use Agent.',
    url: 'https://yetnfbtnyy.feishu.cn/wiki/HJiFw1qYJiQUA3kgndwc3mK6nag?fromScene=spaceOverview',
  },
  [Operator.RemoteBrowser]: {
    text: 'If you need to use it for a long-term and stable period, you can log in to the Volcano Engine FaaS to experience the Online Browser Use Agent.',
    url: 'https://yetnfbtnyy.feishu.cn/docx/ZLbod0j2ho2QAExDbGicdoTWnqd?from=from_copylink',
  },
};
