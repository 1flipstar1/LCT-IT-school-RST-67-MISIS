/**
 * Салют в конце курса: конфетти из двух нижних углов и несколько фейерверков.
 *
 * Рисуется на своём canvas поверх страницы (а не в слое тура), поэтому продолжает догорать после
 * закрытия тура; холст удаляется, когда погасла последняя частица. Физика — простая покадровая:
 * скорость, гравитация, сопротивление воздуха и затухание, всё умножается на delta, чтобы на
 * мониторах 60 и 120 Гц салют длился одинаково.
 */

import { shouldReduceMotion } from '../../lib/motion.js';

const TOKENS = ['--color-brand', '--color-accent', '--color-brand-hover', '--color-warning-text', '--color-brand-soft', '--color-warning-soft'];
const FRAME = 1000 / 60;
const MAX_DURATION = 9000;
/**
 * Физика в пикселях за один кадр 60 Гц. Сопротивление воздуха — доля скорости, которая остаётся
 * после кадра; при пропуске кадров её возводят в степень числа кадров (0.985² за два кадра),
 * иначе на медленном устройстве частицы тормозили бы слабее.
 */
const GRAVITY = { confetti: 0.22, spark: 0.06 };
const DRAG = { confetti: 0.985, spark: 0.96 };
/** Конфетти падает не быстрее этого: бумажка парит, а не летит камнем. */
const CONFETTI_MAX_FALL_SPEED = 4.5;
/** Покачивание конфетти из стороны в сторону: скорость фазы и размах. */
const WOBBLE = { speed: 0.12, amplitude: 1.2 };
/** За кадр анимации считаем не больше трёх: после фоновой вкладки салют не «прыгает». */
const MAX_FRAMES_PER_TICK = 3;
/** Где по ширине экрана взрываются ракеты: вразнобой, чтобы салют заполнял всё небо. */
const BURST_X = [0.22, 0.72, 0.4, 0.86, 0.14, 0.58];

const random = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function palette() {
  const root = getComputedStyle(document.documentElement);
  const colors = TOKENS.map((token) => root.getPropertyValue(token).trim()).filter(Boolean);
  return colors.length ? colors : ['#8300ff', '#ff4f12'];
}

function createCanvas() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 'calc(var(--z-toast) + 20)' });
  document.body.appendChild(canvas);
  return canvas;
}

/** Хлопушка: веер конфетти из угла экрана вверх и к центру. */
function popper(particles, colors, { x, y, direction, scale }) {
  for (let index = 0; index < 110; index += 1) {
    const angle = (-Math.PI / 2) + direction * random(0.15, 0.75);
    const speed = random(12, 24) * scale;
    particles.push({
      kind: 'confetti',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      width: random(8, 14),
      height: random(4, 7),
      rotation: random(0, Math.PI * 2),
      spin: random(-0.25, 0.25),
      wobble: random(0, Math.PI * 2),
      color: pick(colors),
      life: 1,
      decay: random(0.004, 0.007),
    });
  }
}

/** Ракета взлетает к точке взрыва, оставляя искристый след. */
function rocket(particles, colors, { x, targetY, height }) {
  particles.push({ kind: 'rocket', x, y: height, vx: random(-0.6, 0.6), vy: -Math.sqrt(2 * GRAVITY.spark * (height - targetY)) * 1.02, targetY, color: pick(colors), life: 1, decay: 0 });
}

function explode(particles, colors, { x, y }) {
  const count = Math.round(random(80, 110));
  const main = pick(colors);
  const second = pick(colors);
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + random(-0.05, 0.05);
    const speed = random(3, 7.5);
    particles.push({
      kind: 'spark',
      x,
      y,
      px: x,
      py: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: random(2.4, 3.6),
      color: index % 3 ? main : second,
      life: 1,
      decay: random(0.01, 0.016),
    });
  }
}

/**
 * Сдвинуть все частицы на frames кадров 60 Гц. Идём с конца массива: так можно удалять
 * погасшие частицы прямо в цикле, а искры от взорвавшейся ракеты добавляются в конец и
 * начнут двигаться со следующего кадра.
 */
function step(particles, colors, frames) {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    if (particle.kind === 'confetti') {
      const drag = DRAG.confetti ** frames;
      particle.vx *= drag;
      particle.vy = Math.min(particle.vy * drag + GRAVITY.confetti * frames, CONFETTI_MAX_FALL_SPEED);
      particle.wobble += WOBBLE.speed * frames;
      particle.x += (particle.vx + Math.cos(particle.wobble) * WOBBLE.amplitude) * frames;
      particle.y += particle.vy * frames;
      particle.rotation += particle.spin * frames;
    } else if (particle.kind === 'rocket') {
      particle.vy += GRAVITY.spark * frames;
      particle.x += particle.vx * frames;
      particle.y += particle.vy * frames;
      // Взрыв — в верхней точке полёта или на заданной высоте, что наступит раньше.
      if (particle.vy >= 0 || particle.y <= particle.targetY) {
        explode(particles, colors, particle);
        particle.life = 0;
      }
    } else {
      // Прошлая позиция нужна, чтобы нарисовать искру чёрточкой-следом, а не точкой.
      particle.px = particle.x;
      particle.py = particle.y;
      const drag = DRAG.spark ** frames;
      particle.vx *= drag;
      particle.vy = particle.vy * drag + GRAVITY.spark * frames;
      particle.x += particle.vx * frames;
      particle.y += particle.vy * frames;
    }
    particle.life -= particle.decay * frames;
    const fellOut = particle.y > window.innerHeight + 40 && particle.vy > 0;
    if (particle.life <= 0 || fellOut) particles.splice(index, 1);
  }
}

function draw(context, particles) {
  for (const particle of particles) {
    context.globalAlpha = Math.max(0, Math.min(1, particle.life * 1.6));
    context.fillStyle = particle.color;
    context.strokeStyle = particle.color;
    if (particle.kind === 'confetti') {
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      // Конфетти «переворачивается» в полёте: ширина пульсирует вместе с покачиванием.
      context.fillRect(-particle.width / 2, -particle.height / 2, particle.width * Math.abs(Math.cos(particle.wobble)), particle.height);
      context.restore();
    } else if (particle.kind === 'rocket') {
      context.beginPath();
      context.arc(particle.x, particle.y, 2.6, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 0.35;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(particle.x, particle.y);
      context.lineTo(particle.x - particle.vx * 4, particle.y - particle.vy * 4);
      context.stroke();
    } else {
      context.lineWidth = particle.radius;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(particle.x - (particle.x - particle.px) * 3, particle.y - (particle.y - particle.py) * 3);
      context.lineTo(particle.x, particle.y);
      context.stroke();
    }
  }
  context.globalAlpha = 1;
}

export function celebrate() {
  if (shouldReduceMotion()) return;
  const canvas = createCanvas();
  const context = canvas.getContext('2d');
  const colors = palette();
  const particles = [];
  // Холст в физических пикселях экрана, рисуем в CSS-пикселях — на Retina салют не будет мыльным.
  const pixelRatio = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  context.scale(pixelRatio, pixelRatio);

  const scale = Math.max(0.7, Math.min(1.3, height / 800));
  const schedule = [
    { at: 0, run: () => { popper(particles, colors, { x: 0, y: height, direction: 1, scale }); popper(particles, colors, { x: width, y: height, direction: -1, scale }); } },
    ...[350, 800, 1250, 1700, 2200, 2700].map((at, index) => ({
      at,
      run: () => rocket(particles, colors, { x: width * BURST_X[index], targetY: height * random(0.1, 0.22), height }),
    })),
    { at: 1900, run: () => { popper(particles, colors, { x: 0, y: height, direction: 1, scale: scale * 0.85 }); popper(particles, colors, { x: width, y: height, direction: -1, scale: scale * 0.85 }); } },
  ].sort((a, b) => a.at - b.at);

  const started = performance.now();
  let previous = started;
  const frame = (now) => {
    const elapsed = now - started;
    const frames = Math.min(MAX_FRAMES_PER_TICK, (now - previous) / FRAME);
    previous = now;
    while (schedule.length && schedule[0].at <= elapsed) schedule.shift().run();

    step(particles, colors, frames);
    context.clearRect(0, 0, width, height);
    draw(context, particles);

    if ((schedule.length || particles.length) && elapsed < MAX_DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
