import { downloadBlob } from '../download.js';

const PADDING = 24;
const TITLE_HEIGHT = 40;
const SCALE = 2;
const STYLE_PROPERTIES = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'opacity', 'font-size', 'font-weight', 'font-family', 'text-anchor', 'dominant-baseline'];

/**
 * Превращает SVG-график в картинку: подставляет вычисленные стили (цвета из CSS-токенов),
 * иначе вне страницы график потеряет оформление. Используется для PNG и PDF.
 */
export async function svgToImage(svg) {
  const { width, height } = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true);
  inlineComputedStyles(svg, clone);
  clone.setAttribute('width', width);
  clone.setAttribute('height', height);

  const source = new XMLSerializer().serializeToString(clone);
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`);
  return { image, width, height };
}

/**
 * Сохраняет в PNG все SVG-графики внутри контейнера — на тех же местах, что и на экране
 * (например, кольцевая диаграмма и столбцы рядом). Сверху — заголовок, чтобы картинка была понятна вне системы.
 */
export async function downloadChartAsPng(container, { title, fileName }) {
  const bounds = container.getBoundingClientRect();
  const svgs = [...container.querySelectorAll('svg')].filter((svg) => svg.getBoundingClientRect().width > 0);
  const titleHeight = title ? TITLE_HEIGHT : 0;

  const canvas = document.createElement('canvas');
  canvas.width = (bounds.width + PADDING * 2) * SCALE;
  canvas.height = (bounds.height + PADDING * 2 + titleHeight) * SCALE;

  const context = canvas.getContext('2d');
  context.scale(SCALE, SCALE);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (title) {
    context.fillStyle = '#1d1d22';
    context.font = '700 18px RostelecomBasis, sans-serif';
    context.fillText(title, PADDING, PADDING + 18);
  }

  for (const svg of svgs) {
    const rect = svg.getBoundingClientRect();
    const { image, width, height } = await svgToImage(svg);
    context.drawImage(image, PADDING + rect.left - bounds.left, PADDING + titleHeight + rect.top - bounds.top, width, height);
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  downloadBlob(blob, fileName);
}

function inlineComputedStyles(sourceRoot, targetRoot) {
  const sourceNodes = [sourceRoot, ...sourceRoot.querySelectorAll('*')];
  const targetNodes = [targetRoot, ...targetRoot.querySelectorAll('*')];
  sourceNodes.forEach((node, index) => {
    const computed = getComputedStyle(node);
    const style = STYLE_PROPERTIES.map((property) => `${property}:${computed.getPropertyValue(property)}`).join(';');
    targetNodes[index].setAttribute('style', style);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
