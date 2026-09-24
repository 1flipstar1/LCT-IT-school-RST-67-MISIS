import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Голосовой ввод и озвучивание ответов средствами браузера: бесплатно и без отправки звука на наш сервер.
 * Если браузер не умеет распознавать речь, кнопка микрофона просто не показывается.
 */
const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined;

export const speechInputSupported = Boolean(Recognition);
export const speechOutputSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Разметка ответа мешает озвучиванию: «**Отчёты** — …» → «Отчёты — …». */
const plainText = (text) => text.replace(/[*_`#>]/g, '').replace(/^\s*[-•]\s+/gm, '');

export function speak(text) {
  if (!speechOutputSupported || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(plainText(text));
  utterance.lang = 'ru-RU';
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (speechOutputSupported) window.speechSynthesis.cancel();
}

/** onText получает распознанный текст по мере речи, onFinal — итоговую фразу. */
export function useSpeechRecognition({ onText, onFinal }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const handlersRef = useRef({ onText, onFinal });
  handlersRef.current = { onText, onFinal };

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const start = useCallback(() => {
    if (!Recognition || recognitionRef.current) return;
    const recognition = new Recognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = [...event.results].map((result) => result[0].transcript).join('');
      handlersRef.current.onText(transcript);
      if (event.results[event.results.length - 1].isFinal) handlersRef.current.onFinal?.(transcript);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onerror = recognition.onend;
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, []);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  return { supported: speechInputSupported, listening, start, stop };
}
