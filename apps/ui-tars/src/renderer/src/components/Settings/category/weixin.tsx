/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useMemo, useState } from 'react';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { QRCodeCanvas } from 'qrcode.react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { WeixinTaskOperator } from '@main/store/types';
import { useSetting } from '@renderer/hooks/useSetting';
import { Button } from '@renderer/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@renderer/components/ui/form';
import { Switch } from '@renderer/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';

import type { WeixinServiceStatus } from '@/main/services/weixin';

const formSchema = z.object({
  weixinEnabled: z.boolean(),
  weixinTaskOperator: z.nativeEnum(WeixinTaskOperator),
});

export function WeixinSettings() {
  const { settings, updateSetting } = useSetting();
  const [status, setStatus] = useState<WeixinServiceStatus | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteTargetAccount, setDeleteTargetAccount] = useState<
    WeixinServiceStatus['accounts'][number] | null
  >(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      weixinEnabled: false,
      weixinTaskOperator: WeixinTaskOperator.LocalComputer,
    },
  });

  const [enabled, taskOperator] = form.watch([
    'weixinEnabled',
    'weixinTaskOperator',
  ]);

  useEffect(() => {
    void window.electron.weixin.getStatus().then(setStatus);

    const unsubscribe = window.electron.weixin.onStatusUpdated((nextStatus) => {
      setStatus(nextStatus);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!Object.keys(settings).length) {
      return;
    }

    const nextValues = {
      weixinEnabled: settings.weixinEnabled ?? false,
      weixinTaskOperator:
        settings.weixinTaskOperator ?? WeixinTaskOperator.LocalComputer,
    };
    const currentValues = form.getValues();

    if (
      currentValues.weixinEnabled === nextValues.weixinEnabled &&
      currentValues.weixinTaskOperator === nextValues.weixinTaskOperator
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
      weixinEnabled: enabled,
      weixinTaskOperator: taskOperator,
    };

    if (
      settings.weixinEnabled === nextSettings.weixinEnabled &&
      settings.weixinTaskOperator === nextSettings.weixinTaskOperator
    ) {
      return;
    }

    const saveTimer = window.setTimeout(() => {
      updateSetting(nextSettings);
    }, 1000);

    return () => {
      window.clearTimeout(saveTimer);
    };
  }, [enabled, taskOperator, settings, updateSetting]);

  const statusText = useMemo(() => {
    if (!status) {
      return 'Loading status...';
    }

    if (status.loginPending) {
      return '二维码登录正在等待微信确认。';
    }

    if (status.monitoring && status.accountCount > 0) {
      return `成功登录 ${status.accountCount} 微信账号`;
    }

    if (status.accountCount > 0) {
      return `Connected ${status.accountCount} account(s). Turn on the switch above to start listening.`;
    }

    return 'No WeChat account connected yet.';
  }, [status]);

  const handleStartLogin = async () => {
    setLoginLoading(true);
    try {
      await window.electron.weixin.startLogin();
    } finally {
      setLoginLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteTargetAccount) {
      return;
    }

    setDeleteLoading(true);
    try {
      const deleted = await window.electron.weixin.deleteAccount(
        deleteTargetAccount.accountId,
      );

      if (!deleted) {
        toast.error('删除失败', {
          description: '没有找到这个已对接账号，或者它已经被删除。',
        });
        return;
      }

      toast.success('已删除微信账号');
    } catch (error) {
      toast.error('删除失败', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setDeleteLoading(false);
      setDeleteTargetAccount(null);
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-8">
        <FormField
          control={form.control}
          name="weixinEnabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <FormLabel>启用微信监听</FormLabel>
                <FormDescription>
                  启用后，Control将向微信发起长轮询，并将收到的短信消息转换为本地代理任务。
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
          name="weixinTaskOperator"
          render={({ field }) => (
            <FormItem>
              <FormLabel>微信任务模式</FormLabel>
              <FormDescription>可选择控制电脑或浏览器</FormDescription>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select the execution target" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={WeixinTaskOperator.LocalComputer}>
                    操作电脑
                  </SelectItem>
                  <SelectItem value={WeixinTaskOperator.LocalBrowser}>
                    操作浏览器
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">登录</div>
            <div className="text-sm text-muted-foreground">{statusText}</div>
            {status?.lastError ? (
              <div className="text-sm text-destructive">{status.lastError}</div>
            ) : null}
          </div>

          <Button
            type="button"
            onClick={handleStartLogin}
            disabled={loginLoading || status?.loginPending}
          >
            {status?.loginPending ? '扫码登陆...' : '显示二维码'}
          </Button>

          {status?.qrCodeUrl ? (
            <div className="space-y-2">
              <div className="inline-flex rounded-md border bg-white p-2">
                <QRCodeCanvas
                  value={status.qrCodeUrl}
                  size={224}
                  includeMargin
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {status.qrCodeMessage ?? 'Scan this QR code with WeChat.'}
              </div>
            </div>
          ) : null}

          {status?.accounts?.length ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">对接信息</div>
              <div className="space-y-2">
                {status.accounts.map((account) => (
                  <div
                    key={account.accountId}
                    className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium break-all">
                        {account.accountId}
                      </div>
                      <div className="text-muted-foreground break-all">
                        {account.userId
                          ? `User: ${account.userId}`
                          : 'User id unavailable'}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="shrink-0"
                      onClick={() => setDeleteTargetAccount(account)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </form>

      <AlertDialog
        open={Boolean(deleteTargetAccount)}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) {
            setDeleteTargetAccount(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除已对接微信账号</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargetAccount
                ? `确认删除账号 ${deleteTargetAccount.accountId} 吗？删除后会清除本地保存的登录信息和监听状态，需要重新扫码登录。`
                : '确认删除这个已对接微信账号吗？'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteAccount();
              }}
              disabled={deleteLoading}
            >
              {deleteLoading ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
