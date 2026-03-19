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

import type { FeishuTaskPayload } from '@/main/services/feishu';

export function FeishuTaskBridge() {
  const navigate = useNavigate();
  const { createSession } = useSession();
  const { settings, updateSetting } = useSetting();
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const unsubscribe = window.electron.feishu.onTaskReceived(
      async (task: FeishuTaskPayload) => {
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
              source: 'feishu',
              taskId: task.taskId,
              chatId: task.chatId,
              messageId: task.messageId,
            },
            {
              skipClearHistory: true,
            },
          );

          if (!session) {
            throw new Error('Failed to create session for feishu task');
          }

          navigate('/local', {
            state: {
              operator: runtimeOperator,
              sessionId: session.id,
              from: 'feishu',
            },
          });

          toast.success('已收到飞书任务，软件开始执行');
        } catch (error) {
          toast.error('飞书任务启动失败', {
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
