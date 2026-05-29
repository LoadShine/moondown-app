import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { chromium } from '@playwright/test';

const host = '127.0.0.1';
let serverProcess;

const rootUrl = await startViteServer();

try {
  await runAppUiChecks(rootUrl);
  console.log('Moondown app UI check passed.');
} finally {
  await stopViteServer();
}

async function runAppUiChecks(url) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    await assertHiddenCommandBarStaysOutOfTabOrder(page);
    await assertSearchReplaceWorkflow(page);
    await assertCmdWResetsDocumentWithoutClosingBrowserPage(page);
    await assertMobileCommandMenusStayAccessibleAndInBounds(page);

    assert.deepEqual(errors, [], 'browser console/page errors should be empty');
  } finally {
    await browser.close();
  }
}

async function assertHiddenCommandBarStaysOutOfTabOrder(page) {
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        inCommandBar: !!active?.closest?.('.command-bar'),
        commandBarOpen: document.querySelector('.command-bar')?.classList.contains('open'),
      };
    });
    assert.equal(focus.commandBarOpen, false, 'command bar should start closed');
    assert.equal(focus.inCommandBar, false, 'hidden command bar controls must not receive keyboard focus');
  }
}

async function assertSearchReplaceWorkflow(page) {
  const content = [
    '# Heading',
    '',
    'alpha first',
    '---',
    'alpha after rule',
    'beta alpha beta',
    'plain line',
  ].join('\n');

  await page.locator('.cm-content').click();
  await page.keyboard.press(`${modifierKey()}+A`);
  await page.keyboard.type(content);
  assert.match(await editorText(page), /alpha after rule/);

  await page.keyboard.press(`${modifierKey()}+F`);
  await page.locator('.search-replace-panel input[name="query"]').fill('alpha');
  await page.waitForTimeout(100);

  assert.equal(await selectedText(page), 'alpha', 'first exact match should be selected');
  assert.equal(await page.locator('.search-input-wrap span').first().textContent(), '1/3');
  await assertBoxInsideViewport(page, '.search-replace-panel', 'desktop search panel');

  await page.getByLabel('Next').click();
  await page.waitForTimeout(100);
  assert.equal(await selectedText(page), 'alpha', 'next exact match should be selected');
  assert.equal(await page.locator('.search-input-wrap span').first().textContent(), '2/3');

  await page.keyboard.press(`${modifierKey()}+R`);
  await page.waitForTimeout(100);
  const activeName = await page.evaluate(() => document.activeElement?.getAttribute?.('name'));
  assert.equal(activeName, 'replace', 'Cmd+R with an existing query should focus the replace field');

  await page.locator('.search-replace-panel input[name="replace"]').fill('omega');
  await page.locator('.search-actions .text-action').first().click();
  await page.waitForTimeout(100);
  const afterOne = await editorText(page);
  assert.match(afterOne, /omega after rule/, 'Replace should update the active match after the horizontal rule');
  assert.match(afterOne, /alpha first/, 'Replace should not update an inactive previous match');
  assert.equal(await page.locator('.search-input-wrap span').first().textContent(), '2/2');

  await page.locator('.search-actions .text-action').nth(1).click();
  await page.waitForTimeout(100);
  const afterAll = await editorText(page);
  assert.equal((afterAll.match(/alpha/g) || []).length, 0, 'Replace all should remove all remaining exact matches');
  assert.ok((afterAll.match(/omega/g) || []).length >= 3, 'Replace all should insert replacements');
}

async function assertCmdWResetsDocumentWithoutClosingBrowserPage(page) {
  await page.locator('.cm-content').click();
  await page.keyboard.press(`${modifierKey()}+A`);
  await page.keyboard.type('temporary draft');
  assert.match(await editorText(page), /temporary draft/);

  await page.keyboard.press(`${modifierKey()}+W`);
  await page.waitForTimeout(150);
  assert.equal(page.isClosed(), false, 'Cmd+W should be handled by the app');
  assert.equal((await editorText(page)).trim(), '', 'Cmd+W should reset the document content for the next open');
}

async function assertMobileCommandMenusStayAccessibleAndInBounds(page) {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(page.url(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);

  await page.locator('.command-tray-toggle').click();
  await page.waitForTimeout(160);

  for (const label of ['File', 'Export as', 'View']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(80);
    await assertBoxInsideViewport(page, '.command-menu', `${label} command menu`);
  }

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForTimeout(100);
  await assertBoxInsideViewport(page, '.settings-sheet', 'mobile settings sheet');
}

async function assertBoxInsideViewport(page, selector, label) {
  const box = await page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  assert.ok(box.width > 0 && box.height > 0, `${label} should be visible`);
  assert.ok(box.x >= -0.5, `${label} should not overflow left`);
  assert.ok(box.y >= -0.5, `${label} should not overflow top`);
  assert.ok(box.right <= box.viewportWidth + 0.5, `${label} should not overflow right`);
  assert.ok(box.bottom <= box.viewportHeight + 0.5, `${label} should not overflow bottom`);
}

async function editorText(page) {
  return page.locator('.cm-content').evaluate((node) => node.textContent || '');
}

async function selectedText(page) {
  return page.evaluate(() => getSelection()?.toString() || '');
}

function modifierKey() {
  return process.platform === 'darwin' ? 'Meta' : 'Control';
}

async function startViteServer() {
  const port = await getFreePort();
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const args = ['exec', 'vite', '--host', host, '--port', String(port), '--strictPort'];
  serverProcess = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });

  let output = '';
  serverProcess.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  serverProcess.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  const url = `http://${host}:${port}/`;
  await waitForServer(url, () => output);
  return url;
}

async function stopViteServer() {
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill('SIGTERM');
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2000);
    serverProcess.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function waitForServer(url, getOutput) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    if (serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) {
      throw new Error(`Vite server exited early.\n${getOutput()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Keep polling until Vite is ready or the timeout expires.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for Vite server.\n${getOutput()}`);
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address) resolve(address.port);
        else reject(new Error('Could not allocate a free port.'));
      });
    });
  });
}
