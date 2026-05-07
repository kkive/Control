/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
// /apps/ui-tars/src/renderer/src/pages/settings/index.tsx
import { RefreshCcw, Trash } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { api } from '@renderer/api';
import { SearchEngineForSettings, VLMProviderV2 } from '@main/store/types';
import { useSetting } from '@renderer/hooks/useSetting';
import { Button } from '@renderer/components/ui/button';
import { Switch } from '@renderer/components/ui/switch';
import { Label } from '@renderer/components/ui/label';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@renderer/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import { ScrollArea } from '@renderer/components/ui/scroll-area';
import { Input } from '@renderer/components/ui/input';
import { DragArea } from '@renderer/components/Common/drag';
import { BROWSER_OPERATOR } from '@renderer/const';

import { PresetImport } from './PresetImport';
import { Tabs, TabsList, TabsTrigger } from '@renderer/components/ui/tabs';
import { PresetBanner } from './PresetBanner';

import googleIcon from '@resources/icons/google-color.svg?url';
import bingIcon from '@resources/icons/bing-color.svg?url';
import baiduIcon from '@resources/icons/baidu-color.svg?url';

// 定义表单验证 schema
const formSchema = z.object({
  language: z.enum(['en', 'zh']),
  vlmProvider: z.nativeEnum(VLMProviderV2, {
    message: 'Please select a VLM Provider to enhance resolution',
  }),
  vlmBaseUrl: z.string().url(),
  vlmApiKey: z.string().min(1),
  vlmModelName: z.string().min(1),
  maxLoopCount: z.number().min(25).max(200),
  loopIntervalInMs: z.number().min(0).max(3000),
  searchEngineForBrowser: z.nativeEnum(SearchEngineForSettings),
  reportStorageBaseUrl: z.string().optional(),
  utioBaseUrl: z.string().optional(),
});

const SECTIONS = {
  vlm: 'VLM Settings',
  chat: 'Chat Settings',
  // report: 'Report Settings',
  general: 'General',
} as const;

const APP_DOWNLOAD_URL = 'https://tomato.wutanggroup.com/';

export default function Settings() {
  const { settings, updateSetting, clearSetting, updatePresetFromRemote } =
    useSetting();
  const [isPresetModalOpen, setPresetModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('vlm');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [updateLoading, setUpdateLoading] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('-');
  const [updateDetail, setUpdateDetail] = useState<{
    version: string;
  } | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [userAgreementOpen, setUserAgreementOpen] = useState(false);
  const [privacyAgreementOpen, setPrivacyAgreementOpen] = useState(false);

  const analyticsEnabled = settings.analyticsEnabled ?? true;

  const handleAnalyticsChange = (checked: boolean) => {
    updateSetting({ ...settings, analyticsEnabled: checked });
  };

  useEffect(() => {
    let mounted = true;

    const loadVersion = async () => {
      try {
        const version = await api.getAppVersion();
        if (mounted) {
          setCurrentVersion(version);
        }
      } catch (error) {
        console.error('Failed to get app version:', error);
      }
    };

    void loadVersion();

    return () => {
      mounted = false;
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setUpdateLoading(true);
    setUpdateDetail(null);
    try {
      const detail = await api.checkForUpdatesDetail();
      console.log('detail', detail);
      setCurrentVersion(detail.currentVersion);

      if (detail.updateInfo) {
        setUpdateDetail({
          version: detail.updateInfo.version,
        });
        setUpdateDialogOpen(true);
        return;
      } else if (!detail.isPackaged) {
        toast.info('Unpackaged version does not support update check!');
      } else {
        toast.success('No update available', {
          description: `current version: ${detail.currentVersion} is the latest version`,
          position: 'top-right',
          richColors: true,
        });
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setUpdateLoading(false);
    }
  };

  const isRemoteAutoUpdatedPreset =
    settings?.presetSource?.type === 'remote' &&
    settings.presetSource.autoUpdate;

  console.log('initialValues', settings);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      language: 'en',
      vlmBaseUrl: '',
      vlmApiKey: '',
      vlmModelName: '',
      maxLoopCount: 100,
      loopIntervalInMs: 1000,
      reportStorageBaseUrl: '',
      searchEngineForBrowser: SearchEngineForSettings.GOOGLE,
      utioBaseUrl: '',
      ...settings,
    },
  });
  useEffect(() => {
    if (Object.keys(settings)) {
      form.reset({
        language: settings.language,
        vlmProvider: settings.vlmProvider,
        vlmBaseUrl: settings.vlmBaseUrl,
        vlmApiKey: settings.vlmApiKey,
        vlmModelName: settings.vlmModelName,
        maxLoopCount: settings.maxLoopCount,
        loopIntervalInMs: settings.loopIntervalInMs,
        searchEngineForBrowser: settings.searchEngineForBrowser,
        reportStorageBaseUrl: settings.reportStorageBaseUrl,
        utioBaseUrl: settings.utioBaseUrl,
      });
    }
  }, [settings, form]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.5 },
    );

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (section: string) => {
    sectionRefs.current[section]?.scrollIntoView({ behavior: 'smooth' });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log('onSubmit', values);

    updateSetting(values);
    // toast.success('Settings saved successfully');
    // await api.closeSettingsWindow();
    await api.showMainWindow();
  };

  const onCancel = async () => {
    // await api.closeSettingsWindow();
  };

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
      toast.success('Preset updated successfully');
    } catch (error) {
      toast.error('Failed to update preset', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handleResetPreset = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    await window.electron.setting.resetPreset();
    toast.success('Reset to manual mode successfully', {
      duration: 1500,
    });
  };

  const handleClearSettings = async () => {
    try {
      await clearSetting();
      toast.success('All settings cleared successfully');
    } catch (error) {
      toast.error('Failed to clear settings', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      <DragArea />

      <div className="flex-1 flex gap-4 p-6 overflow-hidden">
        <Tabs
          orientation="vertical"
          value={activeSection}
          onValueChange={scrollToSection}
          className="w-34 shrink-0"
        >
          <TabsList className="flex flex-col h-auto bg-transparent p-0">
            {Object.entries(SECTIONS).map(([key, label]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="justify-start w-full rounded-none border-0 border-l-4 data-[state=active]:shadow-none data-[state=active]:border-primary mb-1"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <ScrollArea className="flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div
                id="vlm"
                ref={(el) => {
                  sectionRefs.current.vlm = el;
                }}
                className="space-y-6 ml-1 mr-4"
              >
                <h2 className="text-lg font-medium">{SECTIONS.vlm}</h2>
                {/* Temporarily hide preset import entry; keep for future restore.
                {!isRemoteAutoUpdatedPreset && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePresetModal}
                  >
                    Import Preset Config
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
                {/* Model Settings Fields */}
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel>Language</FormLabel>
                        <Select
                          disabled={isRemoteAutoUpdatedPreset}
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="zh">中文</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    );
                  }}
                />
                {/* VLM Provider */}
                <FormField
                  control={form.control}
                  name="vlmProvider"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel>VLM Provider</FormLabel>
                        <Select
                          disabled={isRemoteAutoUpdatedPreset}
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select VLM provider" />
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
                {/* VLM Base URL */}
                <FormField
                  control={form.control}
                  name="vlmBaseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VLM Base URL</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isRemoteAutoUpdatedPreset}
                          placeholder="Enter VLM Base URL"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* VLM API Key */}
                <FormField
                  control={form.control}
                  name="vlmApiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VLM API Key</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isRemoteAutoUpdatedPreset}
                          placeholder="Enter VLM API_Key"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {/* VLM Model Name */}
                <FormField
                  control={form.control}
                  name="vlmModelName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VLM Model Name</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isRemoteAutoUpdatedPreset}
                          placeholder="Enter VLM Model Name"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              {/* Chat Settings */}
              <div
                id="chat"
                ref={(el) => {
                  sectionRefs.current.chat = el;
                }}
                className="space-y-6 pt-6 ml-1 mr-4"
              >
                <h2 className="text-lg font-medium">{SECTIONS.chat}</h2>
                <FormField
                  control={form.control}
                  name="maxLoopCount"
                  render={({ field }) => {
                    // console.log('field', field);
                    return (
                      <FormItem>
                        <FormLabel>Max Loop</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            // disabled={isRemoteAutoUpdatedPreset}
                            placeholder="Enter a number between 25-200"
                            {...field}
                            value={field.value === 0 ? '' : field.value}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="loopIntervalInMs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loop Wait Time (ms)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          // disabled={isRemoteAutoUpdatedPreset}
                          placeholder="Enter a number between 0-3000"
                          {...field}
                          value={field.value === 0 ? '' : field.value}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="searchEngineForBrowser"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Search engine for {BROWSER_OPERATOR}:
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-[124px]">
                            <SelectValue placeholder="Select a search engine" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={SearchEngineForSettings.GOOGLE}>
                            <div className="flex items-center gap-2">
                              <img
                                src={googleIcon}
                                alt="Google"
                                className="w-4 h-4"
                              />
                              <span>Google</span>
                            </div>
                          </SelectItem>
                          <SelectItem value={SearchEngineForSettings.BING}>
                            <div className="flex items-center gap-2">
                              <img
                                src={bingIcon}
                                alt="Bing"
                                className="w-4 h-4"
                              />
                              <span>Bing</span>
                            </div>
                          </SelectItem>
                          <SelectItem value={SearchEngineForSettings.BAIDU}>
                            <div className="flex items-center gap-2">
                              <img
                                src={baiduIcon}
                                alt="Baidu"
                                className="w-4 h-4"
                              />
                              <span>Baidu</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {/* Temporarily hide feedback/report section; keep implementation for future restore.
              <div
                id="report"
                ref={(el) => {
                  sectionRefs.current.report = el;
                }}
                className="space-y-6 pt-6 ml-1 mr-4"
              >
                <h2 className="text-lg font-medium">{SECTIONS.report}</h2>
                <FormField
                  control={form.control}
                  name="reportStorageBaseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Report Storage Base URL</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isRemoteAutoUpdatedPreset}
                          placeholder="https://your-report-storage-endpoint.com/upload"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="utioBaseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UTIO Base URL</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isRemoteAutoUpdatedPreset}
                          placeholder="https://your-utio-endpoint.com/collect"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="h-50"></div>
              </div>
              */}

              <div
                id="general"
                ref={(el) => {
                  sectionRefs.current.general = el;
                }}
                className="space-y-6 ml-1 mr-4"
              >
                <h2 className="text-lg font-medium">{SECTIONS.general}</h2>
                <div className="text-sm text-gray-500">{`Current version: v${currentVersion}`}</div>
                <Button
                  variant="outline"
                  type="button"
                  disabled={updateLoading}
                  onClick={handleCheckForUpdates}
                >
                  <RefreshCcw
                    className={`h-4 w-4 mr-2 ${updateLoading ? 'animate-spin' : ''}`}
                  />
                  {updateLoading ? 'Checking...' : 'Check Updates'}
                </Button>
                {updateDetail?.version && (
                  <div className="text-sm text-gray-500">
                    {`New version available: v${updateDetail.version}`}
                  </div>
                )}
                <div className="flex gap-4">
                  <Button
                    variant="link"
                    className="p-0 h-auto text-sm text-muted-foreground"
                    onClick={() => setUserAgreementOpen(true)}
                  >
                    用户协议
                  </Button>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-sm text-muted-foreground"
                    onClick={() => setPrivacyAgreementOpen(true)}
                  >
                    隐私协议
                  </Button>
                </div>
                <div className="h-50" />
              </div>
            </form>
          </Form>
        </ScrollArea>
      </div>

      <div className="border-t p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            type="button"
            className="text-red-400 border-red-400 hover:bg-red-50 hover:text-red-500"
            onClick={handleClearSettings}
          >
            <Trash className="h-4 w-4" />
            Clear
          </Button>
          <div className="flex gap-4">
            <Button variant="outline" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" onClick={form.handleSubmit(onSubmit)}>
              Save
            </Button>
          </div>
        </div>
      </div>

      <PresetImport
        isOpen={isPresetModalOpen}
        onClose={() => setPresetModalOpen(false)}
      />

      <AlertDialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>New version available</AlertDialogTitle>
            <AlertDialogDescription>
              {`Detected latest version: v${updateDetail?.version ?? '-'}. Click "Download" to install the latest package.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Later</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                window.open(APP_DOWNLOAD_URL, '_blank', 'noopener,noreferrer')
              }
            >
              Download
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={userAgreementOpen} onOpenChange={setUserAgreementOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>用户协议</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div data-slot="alert-dialog-description" className="text-muted-foreground text-sm space-y-3">
                <p>
                  欢迎使用 Control。在使用本应用程序之前，请仔细阅读以下用户协议。
                </p>
                <p>
                  本应用程序提供的功能基于人工智能技术，通过自动化操作帮助用户完成设备上的任务。使用本应用程序即表示您同意以下条款：
                </p>
                <p>
                  1. 本应用程序按"现状"提供，不作任何明示或暗示的保证。
                </p>
                <p>
                  2. 用户应合理使用本应用程序，不得将其用于任何违法或有害的目的。
                </p>
                <p>
                  3. 用户在使用过程中产生的操作结果由用户自行承担。
                </p>
                <p>
                  4. 我们保留随时修改本协议的权利，修改后的协议将在应用程序中公布。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>确定</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={privacyAgreementOpen} onOpenChange={setPrivacyAgreementOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>隐私协议</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div data-slot="alert-dialog-description" className="text-muted-foreground text-sm space-y-3">
                <p>
                  我们重视您的隐私保护。本隐私协议说明了我们如何收集、使用和保护您的信息。
                </p>
                <p>
                  1. 本应用程序可能会收集匿名使用数据以改进服务质量，包括页面浏览、功能使用频率等统计信息。
                </p>
                <p>
                  2. 我们不会收集您的个人身份信息，除非您主动提供。
                </p>
                <p>
                  3. 收集的数据仅用于产品改进和服务优化，不会用于其他商业目的。
                </p>
                <p>
                  4. 您可以随时在设置中关闭数据收集功能。
                </p>
                <p>
                  5. 我们采取合理的安全措施保护您的数据安全。
                </p>
                <div className="flex items-center justify-between pt-3 border-t">
                  <Label htmlFor="analytics-switch-standalone" className="text-sm text-foreground">
                    允许分析数据
                  </Label>
                  <Switch
                    id="analytics-switch-standalone"
                    checked={analyticsEnabled}
                    onCheckedChange={handleAnalyticsChange}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>确定</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { Settings as Component };
