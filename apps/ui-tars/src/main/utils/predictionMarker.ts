/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { type PredictionParsed } from '@ui-tars/shared/types';

import { Operator } from '@main/store/types';

const WINDOWS_INPUT_ACTION_TYPES = new Set([
  'type',
  'hotkey',
  'press',
  'release',
]);

export const shouldShowPredictionMarker = ({
  operator,
  predictions,
  isWindows,
}: {
  operator: Operator;
  predictions?: PredictionParsed[] | null;
  isWindows: boolean;
}) => {
  if (operator !== Operator.LocalComputer || !predictions?.length) {
    return false;
  }

  if (!isWindows) {
    return true;
  }

  return predictions.some(
    (prediction) => !WINDOWS_INPUT_ACTION_TYPES.has(prediction.action_type),
  );
};
