#!/usr/bin/env node
/**
 * Скриншоты для базы знаний (public/help/*.png).
 *
 * Запуск: поднять стенд (frontend :5173, API :8000), затем
 *   node scripts/capture-help-screenshots.mjs
 * Переменные: BASE_URL (по умолчанию http://localhost:5173), CHROME — путь к Google Chrome.
 *
 * Скрипт только открывает экраны и диалоги, ничего не сохраняя. Вход — через демо-авторизацию API
 * (роль администратора, чтобы были видны все разделы). Курс новичка на время съёмки помечается
 * пройденным, а в конце отметка возвращается как была.
 * Нужен Node 22+ (встроенный WebSocket) и Google Chrome.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'help');
const PORT = 9400 + Math.floor(Math.random() * 400);
const WIDTH = 1440;
const HEIGHT = 900;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- Chrome и протокол DevTools ----------
const profile = mkdtempSync(join(tmpdir(), 'crm-help-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, `--window-size=${WIDTH},${HEIGHT}`, 'about:blank'], { stdio: 'ignore' });

let version;
for (let attempt = 0; attempt < 50 && !version; attempt += 1) {
  await sleep(200);
  version = await fetch(`http://localhost:${PORT}/json/version`).then((response) => response.json()).catch(() => null);
}
if (!version) throw new Error('Chrome не запустился — проверьте переменную CHROME');

const socket = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
let messageId = 0;
let sessionId;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
  // Окна с несохранённым черновиком спрашивают «Покинуть страницу?» — соглашаемся, ничего не сохраняя.
  if (message.method === 'Page.javascriptDialogOpening') {
    socket.send(JSON.stringify({ id: ++messageId, sessionId: message.sessionId, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
  }
});
const send = (method, params = {}, session = sessionId) => new Promise((resolve) => {
  const id = ++messageId;
  pending.set(id, resolve);
  socket.send(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }));
});
const evaluate = async (expression) => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description ?? expression);
  return response.result?.result?.value;
};

const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' }, null);
({ result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true }, null));
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });

// ---------- Действия на странице ----------
/** Каждый экран — с перезагрузкой: окна и уведомления предыдущего экрана не попадут в кадр. */
const open = async (path, wait = 1800) => {
  await send('Page.navigate', { url: `${BASE_URL}/#${path}` });
  await sleep(300);
  await send('Page.reload');
  await sleep(wait);
};
const shot = async (name) => {
  await sleep(500);
  const { result } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, name), Buffer.from(result.data, 'base64'));
  console.log(`✓ ${name}`);
};
/** Нажать кнопку или ссылку по началу текста (или aria-label). */
const click = async (text, scope = 'body') => {
  const found = await evaluate(`(() => {
    const nodes = [...document.querySelectorAll('${scope} button, ${scope} a, ${scope} [role=option], ${scope} [role=tab]')];
    const node = nodes.find((item) => item.textContent.trim().startsWith(${JSON.stringify(text)}) || item.getAttribute('aria-label') === ${JSON.stringify(text)});
    node?.click();
    return Boolean(node);
  })()`);
  if (!found) console.warn(`  ! не найдено: «${text}»`);
  await sleep(700);
};
const scrollTo = async (selector) => {
  await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'center' })`);
  await sleep(500);
};
const type = (selector, value) => evaluate(`(() => {
  const input = document.querySelector(${JSON.stringify(selector)});
  const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
})()`);
const sendToAssistant = async (text, wait = 2200) => {
  await type('#assistant-input', text);
  await evaluate(`document.querySelector('#assistant-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
  await sleep(wait);
};
const api = (path, init = {}) => evaluate(`(async () => {
  const session = JSON.parse(sessionStorage.getItem('crm.session') || 'null');
  const response = await fetch('/api/v1${path}', { ...${JSON.stringify(init)}, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session?.accessToken } });
  return response.json();
})()`);

// ---------- Съёмка ----------
let restoreOnboarding = null;
try {
  await open('/', 2500);
  await evaluate('sessionStorage.clear(); localStorage.clear(); location.reload()');
  await sleep(2500);
  await shot('login.png');

  // Демо-вход администратором: сессия как после входа на экране «Вход».
  await evaluate(`(async () => {
    const auth = await fetch('/api/v1/auth/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'admin' }) }).then((r) => r.json());
    sessionStorage.setItem('crm.session', JSON.stringify({ role: auth.user.role, user: auth.user, accessToken: auth.accessToken, tokenType: 'Bearer', expiresAt: Date.now() + auth.expiresIn * 1000 }));
    localStorage.setItem('reports:widgets', JSON.stringify(['kpi-universities', 'kpi-applications', 'chart-applications', 'chart-ranking']));
    localStorage.setItem('interactions:view', JSON.stringify('table'));
  })()`);
  const state = await api('/state');
  const me = state.state.users.find((user) => user.role === 'admin');
  if (!me.onboarding) {
    restoreOnboarding = 'reset';
    await api('/me/onboarding', { method: 'PUT', body: JSON.stringify({ status: 'completed' }) });
  }
  const interactionId = state.state.interactions.find((item) => !item.completedAt)?.id ?? state.state.interactions[0].id;
  // Смена только хеша не перезагружает страницу — а сессию приложение читает при загрузке.
  await evaluate('location.reload()');
  await sleep(3000);

  await open('/', 3000);
  await shot('dashboard.png');
  await scrollTo('[data-tour="attention"]');
  await shot('attention.png');

  await open('/', 2000);
  await evaluate(`window.dispatchEvent(new Event('onboarding:start'))`);
  await sleep(1500);
  await click('Начать', '[role=dialog]');
  await sleep(900);
  await click('Далее', '[role=dialog]');
  await sleep(1800);
  await shot('tour.png');
  // Отметка «пройден» без кнопки «Пропустить» — иначе в следующие кадры попадёт уведомление.
  await api('/me/onboarding', { method: 'PUT', body: JSON.stringify({ status: 'completed' }) });

  await open('/interactions');
  await type('[data-tour="search"] input', 'отчёт');
  await sleep(600);
  await shot('search.png');
  // Очищаем поиск: иначе выпадающий список останется открытым на следующих экранах.
  await type('[data-tour="search"] input', '');
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); document.activeElement?.blur()`);
  await sleep(300);

  await open('/interactions');
  await shot('interactions.png');
  await click('Фильтры');
  await shot('filters.png');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await open('/interactions');
  await click('Новое взаимодействие');
  await shot('new-interaction.png');
  await evaluate(`localStorage.setItem('interactions:view', JSON.stringify('board'))`);
  await open('/interactions', 2500);
  await shot('board.png');
  await evaluate(`localStorage.setItem('interactions:view', JSON.stringify('table'))`);

  await open(`/interactions/${interactionId}`);
  await shot('interaction.png');
  await click('Сменить этап', '#main');
  await shot('transition.png');
  await open(`/interactions/${interactionId}`);
  await click('Изменить', '#main');
  await shot('edit-interaction.png');

  await open('/analytics', 2500);
  await shot('analytics.png');
  await click('Настроить панель');
  await sleep(600);
  await shot('analytics-edit.png');
  await click('Добавить виджет');
  await shot('widget-catalog.png');

  await open('/reports', 2200);
  await shot('reports.png');
  await scrollTo('[data-tour="report-step-3"]');
  await shot('reports-charts.png');
  await evaluate(`[...document.querySelectorAll('#main h2, #main h3')].find((node) => node.textContent.includes('История отчётов'))?.scrollIntoView({ block: 'start' })`);
  await sleep(500);
  await shot('report-history.png');

  await open('/catalogs');
  await shot('catalogs.png');
  await open('/import');
  await shot('import.png');
  await click('Попробовать на примере');
  await shot('import-mapping.png');
  await click('Проверить данные');
  await shot('import-check.png');
  await open('/import');
  await evaluate(`[...document.querySelectorAll('#main h2, #main h3')].find((node) => node.textContent.includes('История импортов'))?.scrollIntoView({ block: 'center' })`);
  await sleep(500);
  await shot('import-history.png');

  await open('/workflows');
  await shot('workflows.png');
  await open('/integrations');
  await shot('integrations.png');
  await open('/users', 2200);
  await shot('users.png');
  await click('Добавить сотрудника');
  await type('[role=dialog] input[placeholder="Мария Иванова"]', 'Мария Иванова');
  await type('[role=dialog] input[type=email]', 'm.ivanova@rt.ru');
  await sleep(400);
  await shot('create-account.png');
  await open('/audit');
  await shot('audit.png');
  await open('/help?section=errors');
  await shot('errors.png');

  await open('/reports');
  await click('Открыть чат');
  await sleep(1600);
  await shot('assistant-home.png');
  await sendToAssistant('Сделай отчёт по КФУ и ИТМО за последний год в PDF');
  await shot('assistant-report.png');
  await sendToAssistant('Как дела у КФУ?', 1500);
  await evaluate(`[...document.querySelectorAll('#main button')].reverse().find((node) => node.textContent.startsWith('КФУ ·'))?.click()`);
  await sleep(2200);
  await shot('assistant-details.png');
  await click('Настройки помощника');
  await sleep(800);
  await shot('assistant-settings.png');
} finally {
  if (restoreOnboarding) await api('/me/onboarding', { method: 'PUT', body: JSON.stringify({ status: restoreOnboarding }) }).catch(() => {});
  socket.close();
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
