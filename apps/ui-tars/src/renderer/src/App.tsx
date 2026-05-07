/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Route, HashRouter, Routes } from 'react-router';
import { lazy, Suspense, useEffect } from 'react';
import { Toaster } from 'sonner';

import { MainLayout } from './layouts/MainLayout';
import { syncClarityAnalyticsConsent } from './utils/clarity';
import { useSetting } from './hooks/useSetting';

import './styles/globals.css';

const Home = lazy(() => import('./pages/home'));
const LocalOperator = lazy(() => import('./pages/local'));
const FreeRemoteOperator = lazy(() => import('./pages/remote/free'));
// const PaidRemoteOperator = lazy(() => import('./pages/remote/paid'));

const Widget = lazy(() => import('./pages/widget'));

function ClarityProvider() {
  const { settings } = useSetting();
  const settingsLoaded = Object.keys(settings).length > 0;

  useEffect(() => {
    if (settingsLoaded) {
      syncClarityAnalyticsConsent(settings.analyticsEnabled ?? true);
    }
  }, [settingsLoaded, settings.analyticsEnabled]);

  return null;
}

export default function App() {
  return (
    <HashRouter>
      <ClarityProvider />
      <Suspense
        fallback={
          <div className="loading-container">
            <div className="loading-spinner" />
          </div>
        }
      >
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/local" element={<LocalOperator />} />
            <Route path="/free-remote" element={<FreeRemoteOperator />} />
            {/* <Route path="/paid-remote" element={<PaidRemoteOperator />} /> */}
          </Route>

          <Route path="/widget" element={<Widget />} />
        </Routes>
        <Toaster
          position="top-right"
          offset={{ top: '48px' }}
          mobileOffset={{ top: '48px' }}
        />
      </Suspense>
    </HashRouter>
  );
}
