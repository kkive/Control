/**
 * Microsoft Clarity manual integration (no @microsoft/clarity dependency).
 * Loads only in production builds. Uses ConsentV2 API with a pre-load queue
 * so consent calls issued before the remote script finishes are not lost.
 */

const CLARITY_PROJECT_ID = 'wn99utaupv';
const CLARITY_SCRIPT_URL = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;

let scriptInjected = false;

/**
 * Ensure the `window.clarity` queue function exists (official manual snippet
 * pattern). Calls made before the real script loads are queued automatically.
 */
function ensureClarityQueue(): void {
  if (typeof window.clarity !== 'function') {
    window.clarity = function () {
      // eslint-disable-next-line prefer-rest-params
      (window.clarity!.q = window.clarity!.q || []).push([...arguments]);
    } as unknown as Window['clarity'];
  }
}

function injectScriptOnce(): void {
  if (scriptInjected) return;
  scriptInjected = true;
  const script = document.createElement('script');
  script.src = CLARITY_SCRIPT_URL;
  script.async = true;
  document.head.appendChild(script);
}

/**
 * Synchronize Clarity analytics consent with the user's preference.
 * - Not production: no-op.
 * - Enabled: create the clarity queue, inject the script once, grant consent.
 * - Disabled: if clarity already loaded, deny consent; do NOT inject a new script.
 */
export function syncClarityAnalyticsConsent(enabled: boolean): void {
  if (!import.meta.env.PROD) return;

  if (enabled) {
    ensureClarityQueue();
    injectScriptOnce();
    window.clarity!('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'granted',
    });
  } else {
    if (typeof window.clarity === 'function') {
      window.clarity('consentv2', {
        ad_Storage: 'denied',
        analytics_Storage: 'denied',
      });
      window.clarity('consent', false);
    }
  }
}
