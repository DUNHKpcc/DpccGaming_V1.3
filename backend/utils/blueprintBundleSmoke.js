const path = require('node:path');
const { pathToFileURL } = require('node:url');

const validateBlueprintRunBundleBrowser = async ({
  bundleDir = '',
  timeoutMs = 5000,
  playwright: injectedPlaywright = null
} = {}) => {
  const normalizedBundleDir = String(bundleDir || '').trim();
  const indexPath = path.join(normalizedBundleDir, 'index.html');
  const issues = [];
  const diagnostics = {
    url: pathToFileURL(indexPath).toString(),
    title: '',
    hasAppRoot: false,
    appText: ''
  };

  let playwright = injectedPlaywright;
  try {
    if (!playwright) {
      playwright = require('playwright');
    }
  } catch (error) {
    return {
      ok: true,
      skipped: true,
      issues: [`Playwright 不可用，已跳过浏览器级校验: ${error.message}`],
      diagnostics
    };
  }

  if (!playwright?.chromium) {
    return {
      ok: true,
      skipped: true,
      issues: ['当前环境未提供 Chromium，已跳过浏览器级校验。'],
      diagnostics
    };
  }

  let browser = null;

  try {
    browser = await playwright.chromium.launch({
      headless: true
    });
    const page = await browser.newPage();

    page.on('pageerror', (error) => {
      issues.push(`pageerror: ${error.message}`);
    });

    page.on('console', (message) => {
      if (message.type() === 'error') {
        issues.push(`console: ${message.text()}`);
      }
    });

    await page.goto(diagnostics.url, {
      waitUntil: 'load',
      timeout: timeoutMs
    });
    await page.waitForTimeout(180);

    const pageState = await page.evaluate(() => {
      const appRoot = document.getElementById('app');
      return {
        title: document.title || '',
        hasAppRoot: Boolean(appRoot),
        appText: String(appRoot?.textContent || '').trim()
      };
    });

    diagnostics.title = pageState.title;
    diagnostics.hasAppRoot = pageState.hasAppRoot;
    diagnostics.appText = pageState.appText;

    if (!diagnostics.hasAppRoot) {
      issues.push('页面缺少 #app 挂载节点。');
    }

    return {
      ok: issues.length === 0,
      skipped: false,
      issues,
      diagnostics
    };
  } catch (error) {
    const errorMessage = String(error?.message || '');
    if (/Executable doesn't exist|Please run the following command to download new browsers/i.test(errorMessage)) {
      return {
        ok: true,
        skipped: true,
        issues: [`当前环境缺少 Playwright 浏览器二进制，已跳过浏览器级校验: ${error.message}`],
        diagnostics
      };
    }

    return {
      ok: false,
      skipped: false,
      issues: [`bundle smoke 校验失败: ${error.message}`],
      diagnostics
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};

module.exports = {
  validateBlueprintRunBundleBrowser
};
