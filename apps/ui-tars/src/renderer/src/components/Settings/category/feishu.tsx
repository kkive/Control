/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect } from 'react';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { FeishuTaskOperator } from '@main/store/types';
import { useSetting } from '@renderer/hooks/useSetting';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@renderer/components/ui/form';
import { Input } from '@renderer/components/ui/input';
import { Switch } from '@renderer/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';

const formSchema = z.object({
  feishuEnabled: z.boolean(),
  feishuAppId: z.string().optional(),
  feishuAppSecret: z.string().optional(),
  feishuTaskOperator: z.nativeEnum(FeishuTaskOperator),
});

export function FeishuSettings() {
  const { settings, updateSetting } = useSetting();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      feishuEnabled: false,
      feishuAppId: '',
      feishuAppSecret: '',
      feishuTaskOperator: FeishuTaskOperator.LocalComputer,
    },
  });

  const [enabled, appId, appSecret, taskOperator] = form.watch([
    'feishuEnabled',
    'feishuAppId',
    'feishuAppSecret',
    'feishuTaskOperator',
  ]);

  useEffect(() => {
    if (!Object.keys(settings).length) {
      return;
    }

    const nextValues = {
      feishuEnabled: settings.feishuEnabled ?? false,
      feishuAppId: settings.feishuAppId ?? '',
      feishuAppSecret: settings.feishuAppSecret ?? '',
      feishuTaskOperator:
        settings.feishuTaskOperator ?? FeishuTaskOperator.LocalComputer,
    };
    const currentValues = form.getValues();

    if (
      currentValues.feishuEnabled === nextValues.feishuEnabled &&
      (currentValues.feishuAppId ?? '') === nextValues.feishuAppId &&
      (currentValues.feishuAppSecret ?? '') === nextValues.feishuAppSecret &&
      currentValues.feishuTaskOperator === nextValues.feishuTaskOperator
    ) {
      return;
    }

    form.reset(nextValues);
  }, [settings, form]);

  useEffect(() => {
    if (!Object.keys(settings).length) {
      return;
    }

    const nextSettings = {
      ...settings,
      feishuEnabled: enabled,
      feishuAppId: appId ?? '',
      feishuAppSecret: appSecret ?? '',
      feishuTaskOperator: taskOperator,
    };

    if (
      settings.feishuEnabled === nextSettings.feishuEnabled &&
      (settings.feishuAppId ?? '') === nextSettings.feishuAppId &&
      (settings.feishuAppSecret ?? '') === nextSettings.feishuAppSecret &&
      settings.feishuTaskOperator === nextSettings.feishuTaskOperator
    ) {
      return;
    }

    const saveTimer = window.setTimeout(() => {
      updateSetting(nextSettings);
    }, 1000);

    return () => {
      window.clearTimeout(saveTimer);
    };
  }, [enabled, appId, appSecret, taskOperator, settings, updateSetting]);

  return (
    <Form {...form}>
      <form className="space-y-8">
        <FormField
          control={form.control}
          name="feishuEnabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <FormLabel>启用飞书长连接</FormLabel>
                <FormDescription>
                  开启后，软件会通过飞书机器人接收文本需求，并在任务完成后回复执行结果。
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="feishuAppId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>App ID</FormLabel>
              <FormDescription>
                建议先填写 App ID 和 App
                Secret，再打开上面的开关，避免频繁重连。
              </FormDescription>
              <FormControl>
                <Input placeholder="cli_xxx" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="feishuAppSecret"
          render={({ field }) => (
            <FormItem>
              <FormLabel>App Secret</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="应用凭证"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="feishuTaskOperator"
          render={({ field }) => (
            <FormItem>
              <FormLabel>飞书任务执行模式</FormLabel>
              <FormDescription>
                当前飞书任务支持直接下发到本地电脑或本地浏览器执行。
              </FormDescription>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择执行模式" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={FeishuTaskOperator.LocalComputer}>
                    本地电脑
                  </SelectItem>
                  <SelectItem value={FeishuTaskOperator.LocalBrowser}>
                    本地浏览器
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
