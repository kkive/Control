/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState, useImperativeHandle } from 'react';
import { CheckCircle, XCircle, Loader2, EyeOff, Eye } from 'lucide-react';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { VLMProviderV2 } from '@main/store/types';
import { useSetting } from '@renderer/hooks/useSetting';
import { Button } from '@renderer/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@renderer/components/ui/form';
import { Input } from '@renderer/components/ui/input';
import { Switch } from '@renderer/components/ui/switch';
import { Alert, AlertDescription } from '@renderer/components/ui/alert';
import { cn } from '@renderer/utils';

import { PresetImport, PresetBanner } from './preset';
import { api } from '@/renderer/src/api';

const FIXED_VLM_PROVIDER = VLMProviderV2.doubao_1_5;

const formSchema = z.object({
  vlmProvider: z.literal(FIXED_VLM_PROVIDER),
  vlmBaseUrl: z.string().url(),
  vlmApiKey: z.string().min(1),
  vlmModelName: z.string().min(1),
  useResponsesApi: z.boolean().default(false),
});

export interface VLMSettingsRef {
  submit: () => Promise<z.infer<typeof formSchema>>;
}

interface VLMSettingsProps {
  ref?: React.RefObject<VLMSettingsRef | null>;
  autoSave?: boolean;
  className?: string;
}

export function VLMSettings({
  ref,
  autoSave = false,
  className,
}: VLMSettingsProps) {
  const { settings, updateSetting, updatePresetFromRemote } = useSetting();
  const [isPresetModalOpen, setPresetModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [responseApiSupported, setResponseApiSupported] = useState<
    boolean | null
  >(null);
  const [isCheckingResponseApi, setIsCheckingResponseApi] = useState(false);

  const isRemoteAutoUpdatedPreset =
    settings?.presetSource?.type === 'remote' &&
    settings.presetSource.autoUpdate;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vlmProvider: FIXED_VLM_PROVIDER,
      vlmBaseUrl: '',
      vlmApiKey: '',
      vlmModelName: '',
      useResponsesApi: false,
    },
  });
  useEffect(() => {
    if (Object.keys(settings).length) {
      form.reset({
        vlmProvider: FIXED_VLM_PROVIDER,
        vlmBaseUrl: settings.vlmBaseUrl,
        vlmApiKey: settings.vlmApiKey,
        vlmModelName: settings.vlmModelName,
        useResponsesApi: settings.useResponsesApi,
      });
    }
  }, [settings, form]);

  const [newBaseUrl, newApiKey, newModelName, newUseResponsesApi] = form.watch(
    ['vlmBaseUrl', 'vlmApiKey', 'vlmModelName', 'useResponsesApi'],
  );

  useEffect(() => {
    if (!autoSave) {
      return;
    }
    if (isRemoteAutoUpdatedPreset) {
      return;
    }

    if (!Object.keys(settings).length) {
      return;
    }
    if (
      newBaseUrl === '' &&
      newApiKey === '' &&
      newModelName === ''
    ) {
      return;
    }

    const validAndSave = async () => {
      if (settings.vlmProvider !== FIXED_VLM_PROVIDER) {
        updateSetting({
          ...settings,
          vlmProvider: FIXED_VLM_PROVIDER,
        });
      }

      const isUrlValid = await form.trigger('vlmBaseUrl');
      if (isUrlValid && newBaseUrl !== settings.vlmBaseUrl) {
        updateSetting({ ...settings, vlmBaseUrl: newBaseUrl });
      }

      const isKeyValid = await form.trigger('vlmApiKey');
      if (isKeyValid && newApiKey !== settings.vlmApiKey) {
        updateSetting({ ...settings, vlmApiKey: newApiKey });
      }

      const isNameValid = await form.trigger('vlmModelName');
      if (isNameValid && newModelName !== settings.vlmModelName) {
        updateSetting({ ...settings, vlmModelName: newModelName });
      }

      const isResponsesApiValid = await form.trigger('useResponsesApi');
      if (
        isResponsesApiValid &&
        newUseResponsesApi !== settings.useResponsesApi
      ) {
        updateSetting({
          ...settings,
          useResponsesApi: newUseResponsesApi,
        });
      }
    };

    validAndSave();
  }, [
    autoSave,
    newBaseUrl,
    newApiKey,
    newModelName,
    newUseResponsesApi,
    settings,
    updateSetting,
    form,
    isRemoteAutoUpdatedPreset,
  ]);

  // Reserved for future preset import entry restore:
  // const handlePresetModal = async (e: React.MouseEvent) => {
  //   e.preventDefault();
  //   e.stopPropagation();
  //
  //   setPresetModalOpen(true);
  // };

  const handleUpdatePreset = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await updatePresetFromRemote();
      // toast.success('Preset updated successfully');
    } catch (error) {
      toast.error('更新预设失败', {
        description:
          error instanceof Error ? error.message : '发生未知错误',
      });
    }
  };

  const handleResetPreset = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    await window.electron.setting.resetPreset();
    toast.success('已成功切换为手动模式', {
      duration: 1500,
    });
  };

  const handleResponseApiChange = async (checked: boolean) => {
    if (checked) {
      if (responseApiSupported === null) {
        setIsCheckingResponseApi(true);
        const modelConfig = {
          baseUrl: newBaseUrl,
          apiKey: newApiKey,
          modelName: newModelName,
        };

        if (
          !modelConfig.baseUrl ||
          !modelConfig.apiKey ||
          !modelConfig.modelName
        ) {
          toast.error(
            '启用 Response API 前请先填写所有必填项',
          );
          setIsCheckingResponseApi(false);
          return;
        }

        const isSupported = await api.checkVLMResponseApiSupport(modelConfig);
        setResponseApiSupported(isSupported);
        setIsCheckingResponseApi(false);

        if (!isSupported) {
          return;
        }
      }

      if (responseApiSupported) {
        form.setValue('useResponsesApi', true);
      }
    } else {
      form.setValue('useResponsesApi', false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log('onSubmit', values);

    updateSetting({
      ...settings,
      ...values,
      vlmProvider: FIXED_VLM_PROVIDER,
    });
    toast.success('设置保存成功');
  };

  useImperativeHandle(ref, () => ({
    submit: async () => {
      return new Promise<z.infer<typeof formSchema>>((resolve, reject) => {
        form.handleSubmit(
          (values) => {
            onSubmit(values);
            resolve(values);
          },
          (errors) => {
            reject(errors);
          },
        )();
      });
    },
  }));

  const switchDisabled =
    isRemoteAutoUpdatedPreset ||
    responseApiSupported === false ||
    isCheckingResponseApi;

  return (
    <>
      <Form {...form}>
        <form className={cn('space-y-8 px-[1px]', className)}>
          {/* Temporarily hide preset import entry; keep for future restore.
          {!isRemoteAutoUpdatedPreset && (
            <Button type="button" variant="outline" onClick={handlePresetModal}>
              导入预设
            </Button>
          )}
          */}
          {isRemoteAutoUpdatedPreset && (
            <PresetBanner
              url={settings.presetSource?.url}
              date={settings.presetSource?.lastUpdated}
              handleUpdatePreset={handleUpdatePreset}
              handleResetPreset={handleResetPreset}
            />
          )}

          {/* VLM 提供商已暂时固定，保留旧的下拉选择逻辑用于后续恢复 */}
          <FormItem>
            <FormLabel>VLM 提供商</FormLabel>
            <FormControl>
              <Input
                className="bg-white"
                value={FIXED_VLM_PROVIDER}
                disabled
              />
            </FormControl>
          </FormItem>
          {/*
          <FormField
            control={form.control}
            name="vlmProvider"
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>VLM 提供商</FormLabel>
                  <Select
                    disabled={isRemoteAutoUpdatedPreset}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="请选择 VLM 提供商" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(VLMProviderV2).map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
          */}
          {/* VLM 基础 URL */}
          <FormField
            control={form.control}
            name="vlmBaseUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>VLM 基础 URL</FormLabel>
                <FormControl>
                  <Input
                    className="bg-white"
                    placeholder="请输入 VLM 基础 URL"
                    {...field}
                    disabled={isRemoteAutoUpdatedPreset}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* VLM API 密钥 */}
          <FormField
            control={form.control}
            name="vlmApiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>VLM API 密钥</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      className="bg-white"
                      placeholder="请输入 VLM API 密钥"
                      {...field}
                      disabled={isRemoteAutoUpdatedPreset}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isRemoteAutoUpdatedPreset}
                    >
                      {showPassword ? (
                        <Eye className="h-4 w-4 text-gray-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
                </FormControl>
              </FormItem>
            )}
          />
          {/* VLM 模型名称 */}
          <FormField
            control={form.control}
            name="vlmModelName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>VLM 模型名称</FormLabel>
                <FormControl>
                  <Input
                    className="bg-white"
                    placeholder="请输入 VLM 模型名称"
                    {...field}
                    disabled={isRemoteAutoUpdatedPreset}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Model Availability Check */}
          <ModelAvailabilityCheck
            modelConfig={{
              baseUrl: newBaseUrl,
              apiKey: newApiKey,
              modelName: newModelName,
            }}
            onResponseApiSupportChange={setResponseApiSupported}
          />

          {/* VLM Model Responses API */}
          <FormField
            control={form.control}
            name="useResponsesApi"
            render={({ field }) => (
              <FormItem>
                <FormLabel>启用 Responses API</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={field.value}
                      disabled={switchDisabled}
                      onCheckedChange={handleResponseApiChange}
                      className={cn(switchDisabled && '!cursor-not-allowed')}
                    />
                    {responseApiSupported === false && (
                      <p className="text-sm text-red-500">
                        当前模型不支持 Response API
                      </p>
                    )}
                    {isCheckingResponseApi && (
                      <p className="text-sm text-muted-foreground flex items-center">
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        正在检查 Response API 支持情况...
                      </p>
                    )}
                  </div>
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>

      <PresetImport
        isOpen={isPresetModalOpen}
        onClose={() => setPresetModalOpen(false)}
      />
    </>
  );
}

interface ModelAvailabilityCheckProps {
  modelConfig: {
    baseUrl: string;
    apiKey: string;
    modelName: string;
  };
  disabled?: boolean;
  className?: string;
  onResponseApiSupportChange?: (supported: boolean) => void;
}

type CheckStatus = 'idle' | 'checking' | 'success' | 'error';

interface CheckState {
  status: CheckStatus;
  message?: string;
  responseApiSupported?: boolean;
}

export function ModelAvailabilityCheck({
  modelConfig,
  disabled = false,
  className,
  onResponseApiSupportChange,
}: ModelAvailabilityCheckProps) {
  const [checkState, setCheckState] = useState<CheckState>({ status: 'idle' });

  const { baseUrl, apiKey, modelName } = modelConfig;
  const isConfigValid = baseUrl && apiKey && modelName;

  useEffect(() => {
    if (checkState.status === 'success' || checkState.status === 'error') {
      setTimeout(() => {
        // Find the nearest scrollable container
        const scrollContainer = document.querySelector(
          '[data-radix-scroll-area-viewport]',
        );
        if (scrollContainer) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 200);
    }
  }, [checkState.status]);

  const handleCheckModel = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isConfigValid) {
      toast.error(
        '检查模型可用性前请先填写所有必填项',
      );
      return;
    }

    setCheckState({ status: 'checking' });

    try {
      const [isAvailable, responseApiSupported] = await Promise.all([
        api.checkModelAvailability(modelConfig),
        api.checkVLMResponseApiSupport(modelConfig),
      ]);

      onResponseApiSupportChange?.(responseApiSupported);

      if (isAvailable) {
        const successMessage = `模型“${modelName}”可用且运行正常${
          responseApiSupported
            ? '，支持 Response API。'
            : '，但不支持 Response API。'
        }`;
        setCheckState({
          status: 'success',
          message: successMessage,
          responseApiSupported,
        });
        console.log('[VLM Model Check] Success:', modelConfig, {
          responseApiSupported,
        });
      } else {
        const errorMessage = `模型“${modelName}”响应异常`;
        setCheckState({
          status: 'error',
          message: errorMessage,
          responseApiSupported,
        });
        console.error('[VLM Model Check] Model not responding:', modelConfig);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '发生未知错误';
      const fullErrorMessage = `连接模型失败：${errorMessage}`;

      setCheckState({
        status: 'error',
        message: fullErrorMessage,
      });

      onResponseApiSupportChange?.(false);

      console.error('[VLM Model Check] Error:', error, {
        baseUrl,
        modelName,
      });
    }
  };

  return (
    <div className={`space-y-4 ${className || ''}`}>
      <Button
        type="button"
        variant="outline"
        onClick={handleCheckModel}
        disabled={
          disabled || checkState.status === 'checking' || !isConfigValid
        }
        className="w-50"
      >
        {checkState.status === 'checking' ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            检查模型中...
          </>
        ) : (
          '检查模型可用性'
        )}
      </Button>

      {checkState.status === 'success' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 !text-green-600" />
          <AlertDescription className="text-green-800">
            {checkState.message}
          </AlertDescription>
        </Alert>
      )}

      {checkState.status === 'error' && (
        <Alert className="border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 !text-red-600" />
          <AlertDescription className="text-red-800">
            {checkState.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

