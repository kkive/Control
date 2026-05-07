/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { ComputerUseUserData } from '@ui-tars/shared/types';

export const CONTROL_REPORT_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Control Report</title>
    <style>
      :root {
        color-scheme: light;
        font-family:
          ui-sans-serif,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
        color: #17202a;
        background: #f6f8fb;
      }

      body {
        margin: 0;
        padding: 32px;
      }

      main {
        max-width: 1080px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #e5ebf3;
        border-radius: 24px;
        box-shadow: 0 24px 60px rgba(20, 36, 64, 0.12);
        overflow: hidden;
      }

      header {
        padding: 28px 32px;
        background: linear-gradient(135deg, #102033, #1f6feb);
        color: #ffffff;
      }

      h1 {
        margin: 0;
        font-size: 30px;
      }

      p {
        margin: 8px 0 0;
        color: rgba(255, 255, 255, 0.78);
      }

      pre {
        margin: 0;
        padding: 28px 32px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 13px;
        line-height: 1.6;
        color: #26364a;
        background: #ffffff;
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Control Report</h1>
        <p>Task transcript, model settings, and operator metadata.</p>
      </header>
      <pre id="control-report">Loading report...</pre>
    </main>
    {{dump}}
    <script>
      (function () {
        var nodes = Array.prototype.slice.call(
          document.querySelectorAll('script[type="control_web_dump"]'),
        );
        var reports = nodes.map(function (node) {
          try {
            return JSON.parse(node.textContent || '{}');
          } catch (error) {
            return { parseError: String(error), raw: node.textContent || '' };
          }
        });
        document.getElementById('control-report').textContent = JSON.stringify(
          reports,
          null,
          2,
        );
      })();
    </script>
  </body>
</html>`;

function replaceStringWithFirstAppearance(
  str: string,
  target: string,
  replacement: string,
) {
  const index = str.indexOf(target);
  return str.slice(0, index) + replacement + str.slice(index + target.length);
}

export function reportHTMLContent(
  tpl: string,
  dumpData: ComputerUseUserData[],
): string {
  let reportContent = '';
  console.log('dumpData', Array.isArray(dumpData));
  if (
    (Array.isArray(dumpData) && dumpData.length === 0) ||
    typeof dumpData === 'undefined'
  ) {
    reportContent = replaceStringWithFirstAppearance(
      tpl,
      '{{dump}}',
      `<script type="control_web_dump" type="application/json"></script>`,
    );
  } else if (typeof dumpData === 'string') {
    reportContent = replaceStringWithFirstAppearance(
      tpl,
      '{{dump}}',
      `<script type="control_web_dump" type="application/json">${dumpData}</script>`,
    );
  } else {
    const dumps = dumpData.map((data) => {
      return `<script type="control_web_dump" type="application/json">${JSON.stringify(data)}\n</script>`;
    });
    reportContent = replaceStringWithFirstAppearance(
      tpl,
      '{{dump}}',
      dumps.join('\n'),
    );
  }

  return reportContent;
}
