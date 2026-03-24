/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';
// import { preloadZustandBridge } from 'zutron/preload';

import type { UTIOPayload } from '@ui-tars/utio';

import type { AppState, LocalStore } from '@main/store/types';
import type { FeishuTaskPayload } from '@main/services/feishu';
import type {
  WeixinServiceStatus,
  WeixinTaskPayload,
} from '@main/services/weixin';

export type Channels = '';

const electronHandler = {
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) =>
      ipcRenderer.invoke(channel, ...args),
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
  utio: {
    shareReport: (params: UTIOPayload<'shareReport'>) =>
      ipcRenderer.invoke('utio:shareReport', params),
  },
  setting: {
    getSetting: () => ipcRenderer.invoke('setting:get'),
    clearSetting: () => ipcRenderer.invoke('setting:clear'),
    updateSetting: (setting: Partial<LocalStore>) =>
      ipcRenderer.invoke('setting:update', setting),
    importPresetFromText: (yamlContent: string) =>
      ipcRenderer.invoke('setting:importPresetFromText', yamlContent),
    importPresetFromUrl: (url: string, autoUpdate: boolean) =>
      ipcRenderer.invoke('setting:importPresetFromUrl', url, autoUpdate),
    updatePresetFromRemote: () =>
      ipcRenderer.invoke('setting:updatePresetFromRemote'),
    resetPreset: () => ipcRenderer.invoke('setting:resetPreset'),
    onUpdate: (callback: (setting: LocalStore) => void) => {
      ipcRenderer.on('setting-updated', (_, state) => callback(state));
    },
  },
  feishu: {
    onTaskReceived: (callback: (task: FeishuTaskPayload) => void) => {
      const subscription = (
        _event: IpcRendererEvent,
        task: FeishuTaskPayload,
      ) => callback(task);

      ipcRenderer.on('feishu:task-received', subscription);

      return () => {
        ipcRenderer.removeListener('feishu:task-received', subscription);
      };
    },
  },
  weixin: {
    getStatus: () => ipcRenderer.invoke('weixin:getStatus'),
    startLogin: () => ipcRenderer.invoke('weixin:startLogin'),
    deleteAccount: (accountId: string) =>
      ipcRenderer.invoke('weixin:deleteAccount', accountId),
    onTaskReceived: (callback: (task: WeixinTaskPayload) => void) => {
      const subscription = (
        _event: IpcRendererEvent,
        task: WeixinTaskPayload,
      ) => callback(task);

      ipcRenderer.on('weixin:task-received', subscription);

      return () => {
        ipcRenderer.removeListener('weixin:task-received', subscription);
      };
    },
    onStatusUpdated: (
      callback: (status: WeixinServiceStatus) => void,
    ) => {
      const subscription = (
        _event: IpcRendererEvent,
        status: WeixinServiceStatus,
      ) => callback(status);

      ipcRenderer.on('weixin:status-updated', subscription);

      return () => {
        ipcRenderer.removeListener('weixin:status-updated', subscription);
      };
    },
  },
};

// Initialize zustand bridge
const zustandBridge = {
  getState: () => ipcRenderer.invoke('getState'),
  subscribe: (callback) => {
    const subscription = (_: unknown, state: AppState) => callback(state);
    ipcRenderer.on('subscribe', subscription);

    return () => ipcRenderer.off('subscribe', subscription);
  },
};

// Expose both electron and zutron handlers
contextBridge.exposeInMainWorld('electron', electronHandler);
contextBridge.exposeInMainWorld('zustandBridge', zustandBridge);
contextBridge.exposeInMainWorld('platform', process.platform);

export type ElectronHandler = typeof electronHandler;
