/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { ElectronHandler } from '../../preload/index';

declare global {
  interface Window {
    electron: ElectronHandler;
    platform: NodeJS.Platform;
    zutron: any;
    clarity?: ((command: string, ...args: unknown[]) => void) & { q?: unknown[][] };
  }
}

declare module 'react' {
  interface CSSProperties {
    '-webkit-app-region'?: 'drag' | 'no-drag';
    '--sidebar-width-icon'?: string;
  }
}
