/**
 * Browser end-to-end test: real React app (Vite) + real Express API + in-memory MongoDB,
 * driven by headless Chrome/Edge. Only the OpenRouter call is mocked.
 *
 *   npm run test:e2e            (set CHROME_PATH if Chrome/Edge isn't auto-detected)
 *
 * Screenshots are written to tests/screenshots/.
 */
import '../../server/tests/setup.js';
import { test, before, after, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { createServer as createViteServer } from 'vite';
import { startTestDB } from '../../server/tests/helpers.js';

// Reuse the mongod binary the server tests already downloaded (instead of a second ~600MB copy)
process.env.MONGOMS_DOWNLOAD_DIR ??= fileURLToPath(
  new URL('../../server/node_modules/.cache/mongodb-memory-server', import.meta.url)
);

const { default: app } = await import('../../server/src/app.js');

const SERVER_PORT = 5991;
const CLIENT_PORT = 5992;
const BASE = `http://localhost:${CLIENT_PORT}`;
const SHOTS = fileURLToPath(new URL('./screenshots/', import.meta.url));

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium'
].filter(Boolean);

const AI_REPLY = 'Our standard warranty covers **hardware defects** for 12 months:\n\n- Free repairs\n- Free replacement parts';

/** Slow SSE stream so the typing indicator and streaming are observable. */
const slowSSE = (text) => {
  const encoder = new TextEncoder();
  const words = text.split(/(?<= )/);
  return new Response(
    new ReadableStream({
      async start(controller) {
        await new Promise((r) => setTimeout(r, 600)); // "thinking"
        for (const word of words) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: word } }] })}\n\n`));
          await new Promise((r) => setTimeout(r, 25));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
  );
};

let stopDB;
let apiServer;
let vite;
let browser;
let page;

const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png` });
const typeInto = async (selector, text) => {
  await page.focus(selector);
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type(selector, text);
};

describe('E2E user journey', () => {
  before(async () => {
    const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
    assert.ok(chromePath, 'Chrome/Edge not found — set CHROME_PATH');
    mkdirSync(SHOTS, { recursive: true });

    stopDB = await startTestDB();

    // Mock only the OpenRouter call; everything else uses the real fetch
    const realFetch = globalThis.fetch;
    mock.method(globalThis, 'fetch', (url, init) =>
      String(url).includes('openrouter.ai') ? slowSSE(AI_REPLY) : realFetch(url, init)
    );

    apiServer = http.createServer(app);
    await new Promise((resolve) => apiServer.listen(SERVER_PORT, resolve));

    vite = await createViteServer({
      configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
      root: fileURLToPath(new URL('..', import.meta.url)),
      server: { port: CLIENT_PORT, strictPort: true },
      define: { 'import.meta.env.VITE_API_URL': JSON.stringify(`http://localhost:${SERVER_PORT}`) },
      logLevel: 'error'
    });
    await vite.listen();

    browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
    page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 820 });
    page.on('pageerror', (err) => console.error('[browser error]', err.message));
  });

  after(async () => {
    await browser?.close();
    await vite?.close();
    apiServer?.close();
    mock.restoreAll();
    await stopDB?.();
  });

  test('unauthenticated users are redirected to /login', async () => {
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle0' });
    assert.equal(new URL(page.url()).pathname, '/login');
    await page.waitForSelector('#login-email');
    await shot('01-login');
  });

  test('auth pages fit small phones without horizontal scrolling', async () => {
    for (const width of [320, 390]) {
      await page.setViewport({ width, height: 760, isMobile: true, hasTouch: true });
      for (const path of ['/login', '/signup']) {
        await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('.auth-card');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 0, `${path} overflows by ${overflow}px at ${width}px`);
        await shot(`m-${width}${path.replace('/', '-')}`);
      }
    }
    await page.setViewport({ width: 1366, height: 820 });
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  });

  test('wrong credentials show an error', async () => {
    await typeInto('#login-email', 'nobody@example.com');
    await typeInto('#login-password', 'WrongPassword1!');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.alert');
    const text = await page.$eval('.alert', (el) => el.textContent);
    assert.match(text, /Invalid email or password/);
  });

  test('signup validates input and creates an account', async () => {
    await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle0' });
    await typeInto('#signup-name', 'Ada Lovelace');
    await typeInto('#signup-email', 'ada@example.com');
    await typeInto('#signup-password', 'Sup3r$ecret!');
    await typeInto('#signup-confirm-password', 'different');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.field-error');
    await shot('02-signup-validation');

    await typeInto('#signup-confirm-password', 'Sup3r$ecret!');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.welcome');
    assert.equal(new URL(page.url()).pathname, '/chat');
    const greeting = await page.$eval('.welcome h2', (el) => el.textContent);
    assert.match(greeting, /Ada/);
    await new Promise((r) => setTimeout(r, 700)); // let entrance animations finish
    await shot('03-chat-welcome');
  });

  test('sending a message shows typing, streams the reply and updates the URL', async () => {
    await page.type('#composer-input', 'What does the warranty cover?');
    await page.keyboard.press('Enter');

    await page.waitForSelector('.typing');
    await shot('04-typing-indicator');

    await page.waitForFunction(() => document.querySelector('.msg.assistant .markdown li'), { timeout: 10_000 });
    await page.waitForSelector('.btn-send'); // stop button turns back into send when done

    assert.match(new URL(page.url()).pathname, /^\/chat\/[a-f0-9]{24}$/);
    const reply = await page.$eval('.msg.assistant .markdown', (el) => el.innerHTML);
    assert.match(reply, /<strong>hardware defects<\/strong>/, 'markdown is rendered');
    await page.waitForSelector('.conv-item.active');
    await shot('05-chat-conversation');
  });

  test('history persists across a reload', async () => {
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.msg.assistant');
    const count = await page.$$eval('.msg', (els) => els.length);
    assert.equal(count, 2);
  });

  test('sidebar collapses to an icon rail, persists, and toggles with Ctrl+B', async () => {
    const sidebarWidth = () => page.$eval('.sidebar', (el) => el.getBoundingClientRect().width);

    await page.click('.sidebar-collapse');
    await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width < 80);
    const listVisible = await page.$eval('.sidebar .conv-item', (el) => el.offsetParent !== null);
    assert.equal(listVisible, false, 'conversation list is hidden in the rail');
    await shot('06a-sidebar-collapsed');

    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.msg.assistant');
    assert.ok((await sidebarWidth()) < 80, 'collapsed state survives a reload');

    await page.keyboard.down('Control');
    await page.keyboard.press('KeyB');
    await page.keyboard.up('Control');
    await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width > 250);
  });

  test('dark mode toggles and persists', async () => {
    await page.click('.sidebar-footer-actions .icon-btn:not(.danger)');
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.msg.assistant');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
    await shot(`06-chat-${theme}`);
  });

  test('mobile layout uses a slide-out sidebar', async () => {
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.waitForSelector('.btn-menu');
    await shot('07-mobile-chat');
    await page.click('.btn-menu');
    await page.waitForSelector('.sidebar.open');
    await new Promise((r) => setTimeout(r, 400));
    await shot('08-mobile-sidebar');
    await page.click('.sidebar-close');

    // Smallest common phone: nothing may overflow horizontally
    await page.setViewport({ width: 320, height: 640, isMobile: true, hasTouch: true });
    await page.waitForSelector('.msg.assistant');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `chat overflows by ${overflow}px at 320px`);
    await new Promise((r) => setTimeout(r, 500));
    await shot('09-mobile-320-chat');
    await page.setViewport({ width: 1366, height: 820 });
  });

  test('deleting a conversation asks for confirmation and removes it', async () => {
    // Toggling the mobile viewport reloads the page; wait for the conversation to load again
    await page.waitForSelector('.conv-item.active');
    await page.click('.chat-header-actions .icon-btn.danger');
    await page.waitForSelector('.modal');
    await new Promise((r) => setTimeout(r, 300));
    await shot('10-confirm-delete');
    await page.click('.modal .btn-danger');
    await page.waitForFunction(() => !document.querySelector('.modal') && location.pathname === '/chat');
    await page.waitForFunction(() => document.querySelectorAll('.conv-item').length === 0);
  });

  test('logout returns to login and protects /chat', async () => {
    await page.click('.sidebar-footer-actions .icon-btn.danger');
    await page.waitForSelector('#login-email');
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle0' });
    assert.equal(new URL(page.url()).pathname, '/login');
  });
});
