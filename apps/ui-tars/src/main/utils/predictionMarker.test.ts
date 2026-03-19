/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';

import { Operator } from '@main/store/types';

import { shouldShowPredictionMarker } from './predictionMarker';

describe('shouldShowPredictionMarker', () => {
  it('returns false when there are no predictions', () => {
    expect(
      shouldShowPredictionMarker({
        operator: Operator.LocalComputer,
        predictions: [],
        isWindows: true,
      }),
    ).toBe(false);
  });

  it('returns false for input-only actions on Windows', () => {
    expect(
      shouldShowPredictionMarker({
        operator: Operator.LocalComputer,
        predictions: [
          {
            action_type: 'type',
            action_inputs: { content: 'hello' },
            reflection: null,
            thought: 'type into the focused window',
          },
        ],
        isWindows: true,
      }),
    ).toBe(false);
  });

  it('returns true for mixed actions on Windows', () => {
    expect(
      shouldShowPredictionMarker({
        operator: Operator.LocalComputer,
        predictions: [
          {
            action_type: 'click',
            action_inputs: { start_box: '[0.1,0.1,0.1,0.1]' },
            reflection: null,
            thought: 'focus the target window',
          },
          {
            action_type: 'type',
            action_inputs: { content: 'hello' },
            reflection: null,
            thought: 'type into the focused window',
          },
        ],
        isWindows: true,
      }),
    ).toBe(true);
  });

  it('returns true for input actions on non-Windows platforms', () => {
    expect(
      shouldShowPredictionMarker({
        operator: Operator.LocalComputer,
        predictions: [
          {
            action_type: 'type',
            action_inputs: { content: 'hello' },
            reflection: null,
            thought: 'type into the focused window',
          },
        ],
        isWindows: false,
      }),
    ).toBe(true);
  });

  it('returns false for non-local-computer operators', () => {
    expect(
      shouldShowPredictionMarker({
        operator: Operator.LocalBrowser,
        predictions: [
          {
            action_type: 'click',
            action_inputs: { start_box: '[0.1,0.1,0.1,0.1]' },
            reflection: null,
            thought: 'click the target element',
          },
        ],
        isWindows: true,
      }),
    ).toBe(false);
  });
});
