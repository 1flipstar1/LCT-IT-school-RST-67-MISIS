import { gsap } from 'gsap';

/**
 * Переход «строка поиска → чат». Поиск запоминает, где он стоял на экране, чтобы экран чата
 * анимировал поле ввода именно из этой точки, а при закрытии вернул его туда же.
 */
export const ASSISTANT_PATH = '/assistant';

let origin = null;
let returnPath = '/';
let pendingQuestion = '';

const currentPath = () => window.location.hash.replace(/^#/, '') || '/';

function rectOf(element) {
  if (!element) return null;
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height, viewportWidth: window.innerWidth };
}

/**
 * Открывает чат. from — элемент, из которого «вылетает» поле ввода (строка поиска).
 * Текущая страница сначала растворяется в размытии, чтобы не исчезать рывком.
 */
export function openAssistant({ question = '', from = null } = {}) {
  const path = currentPath();
  if (!path.startsWith(ASSISTANT_PATH)) returnPath = path;
  origin = rectOf(from);
  pendingQuestion = question.trim();

  const go = () => { window.location.hash = ASSISTANT_PATH; };
  const content = document.querySelector('[data-app-content]');
  if (!content || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    go();
    return;
  }
  // Стили растворения снимает AppLayout в момент смены экрана — иначе страница мигнёт на кадр.
  gsap.to(content, { autoAlpha: 0, y: 8, filter: 'blur(10px)', duration: 0.22, ease: 'power2.in', onComplete: go });
}

/** Данные запуска читаются один раз: повторный рендер экрана не должен повторять анимацию и вопрос. */
export function takeLaunch() {
  const launch = { origin, question: pendingQuestion };
  pendingQuestion = '';
  return launch;
}

/**
 * Закрытие чата: поле ввода запоминает своё место, и строка поиска «прилетает» из него наверх
 * одновременно с тем, как страница проявляется, — две анимации идут параллельно, а не друг за другом.
 */
let returnOrigin = null;

export function closeAssistant(from) {
  returnOrigin = rectOf(from);
  window.location.hash = returnPath;
}

export function takeReturnOrigin() {
  const rect = returnOrigin;
  returnOrigin = null;
  return rect;
}

export const getReturnPath = () => returnPath;
