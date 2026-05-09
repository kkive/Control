/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest';
import { VLMProviderV2 } from './types';

describe('VLMProviderV2', () => {
  it('should have correct values for each provider', () => {
    const cases = [
      [VLMProviderV2.ui_tars_1_0, 'Hugging Face Vision 1.0'],
      [VLMProviderV2.ui_tars_1_5, 'Hugging Face Vision 1.5'],
      [VLMProviderV2.doubao_1_5, 'Doubao'],
      [VLMProviderV2.doubao_1_5_vl, 'VolcEngine Ark Vision Pro'],
      [VLMProviderV2.xiaomi_mimo, 'Xiaomi MiMo'],
    ];

    cases.forEach(([provider, expected]) => {
      expect(provider).toBe(expected);
    });
  });
  it('should have correct value for Doubao provider', () => {
    expect(VLMProviderV2.doubao_1_5).toBe('Doubao');
  });

  it('should have correct value for Xiaomi MiMo provider', () => {
    expect(VLMProviderV2.xiaomi_mimo).toBe('Xiaomi MiMo');
  });

  it('should contain exactly five providers', () => {
    const providerCount = Object.keys(VLMProviderV2).length;
    expect(providerCount).toBe(5);
  });
});
