/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import ElectronStore from 'electron-store';
import yaml from 'js-yaml';

import * as env from '@main/env';
import { logger } from '@main/logger';

import {
  LocalStore,
  SearchEngineForSettings,
  VLMProviderV2,
  Operator,
  FeishuTaskOperator,
  WeixinTaskOperator,
} from './types';
import { validatePreset } from './validate';
import { BrowserWindow } from 'electron';

const FIXED_VLM_PROVIDER = VLMProviderV2.xiaomi_mimo;
const LEGACY_XIAOMI_API_BASE_URL = 'https://api.xiaomimimo.com/v1';
const TOKEN_PLAN_XIAOMI_API_BASE_URL =
  'https://token-plan-cn.xiaomimimo.com/v1';

export const DEFAULT_SETTING: LocalStore = {
  language: 'en',
  vlmProvider: FIXED_VLM_PROVIDER,
  vlmBaseUrl: env.vlmBaseUrl || TOKEN_PLAN_XIAOMI_API_BASE_URL,
  vlmApiKey: env.vlmApiKey || env.mimoApiKey || env.xiaomiApiKey || '',
  vlmModelName: env.vlmModelName || 'mimo-v2.5',
  useResponsesApi: false,
  maxLoopCount: 100,
  loopIntervalInMs: 1000,
  searchEngineForBrowser: SearchEngineForSettings.GOOGLE,
  operator: Operator.LocalComputer,
  reportStorageBaseUrl: '',
  utioBaseUrl: '',
  feishuEnabled: false,
  feishuAppId: '',
  feishuAppSecret: '',
  feishuTaskOperator: FeishuTaskOperator.LocalComputer,
  weixinEnabled: false,
  weixinTaskOperator: WeixinTaskOperator.LocalComputer,
  analyticsEnabled: true,
};

export class SettingStore {
  private static instance: ElectronStore<LocalStore>;

  public static getInstance(): ElectronStore<LocalStore> {
    if (!SettingStore.instance) {
      SettingStore.instance = new ElectronStore<LocalStore>({
        name: 'ui_tars.setting',
        defaults: DEFAULT_SETTING,
      });

      SettingStore.instance.onDidAnyChange((newValue, oldValue) => {
        logger.log(
          `SettingStore: ${JSON.stringify(oldValue)} changed to ${JSON.stringify(newValue)}`,
        );
        // Notify that value updated
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send('setting-updated', newValue);
        });
      });
    }
    return SettingStore.instance;
  }

  public static set<K extends keyof LocalStore>(
    key: K,
    value: LocalStore[K],
  ): void {
    if (key === 'vlmProvider') {
      SettingStore.getInstance().set('vlmProvider', FIXED_VLM_PROVIDER);
      return;
    }
    SettingStore.getInstance().set(key, value);
  }

  public static setStore(state: LocalStore): void {
    SettingStore.getInstance().set({
      ...state,
      vlmProvider: FIXED_VLM_PROVIDER,
    });
  }

  public static get<K extends keyof LocalStore>(key: K): LocalStore[K] {
    if (key === 'vlmProvider') {
      return FIXED_VLM_PROVIDER as LocalStore[K];
    }
    return SettingStore.getInstance().get(key);
  }

  public static remove<K extends keyof LocalStore>(key: K): void {
    SettingStore.getInstance().delete(key);
  }

  public static getStore(): LocalStore {
    const store = SettingStore.getInstance().store;
    const shouldUseTokenPlanDefault =
      store.vlmBaseUrl === LEGACY_XIAOMI_API_BASE_URL &&
      (!store.vlmApiKey || store.vlmApiKey.startsWith('tp-'));
    if (
      store.vlmProvider !== FIXED_VLM_PROVIDER ||
      shouldUseTokenPlanDefault
    ) {
      const nextStore = {
        ...store,
        vlmProvider: FIXED_VLM_PROVIDER,
        vlmBaseUrl: shouldUseTokenPlanDefault
          ? TOKEN_PLAN_XIAOMI_API_BASE_URL
          : store.vlmBaseUrl,
      };
      SettingStore.getInstance().set(nextStore);
      return {
        ...nextStore,
      };
    }
    return store;
  }

  public static clear(): void {
    SettingStore.getInstance().set(DEFAULT_SETTING);
  }

  public static openInEditor(): void {
    SettingStore.getInstance().openInEditor();
  }

  public static async importPresetFromUrl(
    url: string,
    autoUpdate = false,
  ): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch preset: ${response.status}`);
      }

      const yamlText = await response.text();
      const preset = yaml.load(yamlText);
      const validatedPreset = validatePreset(preset);

      SettingStore.setStore({
        ...validatedPreset,
        presetSource: {
          type: 'remote',
          url,
          autoUpdate,
          lastUpdated: Date.now(),
        },
      });
    } catch (error) {
      logger.error(error);
      throw new Error(
        `Failed to import preset: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  public static async importPresetFromText(
    yamlContent: string,
  ): Promise<LocalStore> {
    try {
      const settings = await parsePresetYaml(yamlContent);
      return settings;
    } catch (error) {
      logger.error('Failed to import preset from text:', error);
      throw error;
    }
  }

  public static async fetchPresetFromUrl(url: string): Promise<LocalStore> {
    try {
      const response = await fetch(url);
      const yamlContent = await response.text();
      return await this.importPresetFromText(yamlContent);
    } catch (error) {
      logger.error('Failed to fetch preset from URL:', error);
      throw error;
    }
  }
}

async function parsePresetYaml(yamlContent: string): Promise<LocalStore> {
  const preset = yaml.load(yamlContent);
  const validatedPreset = validatePreset(preset);
  return validatedPreset;
}
