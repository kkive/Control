/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { Operator } from '@main/store/types';
import { useSession } from '@renderer/hooks/useSession';
import { useSetting } from '@renderer/hooks/useSetting';

import type { WeixinTaskPayload } from '@/main/services/weixin';

export function WeixinTaskBridge() {
  const navigate = useNavigate();
  const { createSession } = useSession();
  const { settings, updateSetting } = useSetting();
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const unsubscribe = window.electron.weixin.onTaskReceived(
      async (task: WeixinTaskPayload) => {
        try {
          const runtimeOperator = task.operator as unknown as Operator;

          await updateSetting({
            ...settingsRef.current,
            operator: runtimeOperator,
          });

          const session = await createSession(
            task.instructions,
            {
              operator: runtimeOperator,
              source: 'weixin',
              taskId: task.taskId,
              accountId: task.accountId,
              fromUserId: task.fromUserId,
              messageId: task.messageId,
            },
            {
              skipClearHistory: true,
            },
          );

          if (!session) {
            throw new Error('Failed to create session for weixin task');
          }

          navigate('/local', {
            state: {
              operator: runtimeOperator,
              sessionId: session.id,
              from: 'weixin',
            },
          });

          toast.success('Received a WeChat task. The desktop app has started the run.');
        } catch (error) {
          toast.error('Failed to start the WeChat task', {
            description:
              error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
    );

    return unsubscribe;
  }, [createSession, navigate, updateSetting]);

  return null;
}
