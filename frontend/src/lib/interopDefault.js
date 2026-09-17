/**
 * Пакеты Атомаро собраны в CommonJS. Default-импорт такого модуля в dev-режиме Vite 8 возвращает
 * module.exports целиком (семантика Node), а в продакшен-сборке — уже сам компонент.
 * Хелпер делает результат одинаковым в обоих режимах.
 */
export const interopDefault = (module) => module?.default ?? module;
