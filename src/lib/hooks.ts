import { useCallback, useEffect, useRef, useState } from 'react';

/** Mantém a tela do celular acesa enquanto o componente estiver aberto. */
export function useWakeLock(enabled = true) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* recusado (ex.: bateria fraca) */
      }
      if (cancelled) lock?.release();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release();
    };
  }, [enabled]);
}

/**
 * Rolagem automática da página. `getSpeed` é chamado a cada quadro e retorna px/s,
 * permitindo que cada música do repertório tenha sua própria velocidade.
 */
export function useAutoScroll(getSpeed: () => number) {
  const [playing, setPlaying] = useState(false);
  const speedRef = useRef(getSpeed);
  speedRef.current = getSpeed;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let pos = window.scrollY;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // se a pessoa rolou com o dedo, continua de onde ela parou
      if (Math.abs(window.scrollY - pos) > 3) pos = window.scrollY;
      pos += speedRef.current() * dt;
      window.scrollTo(0, pos);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (pos >= max - 1) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggle = useCallback(() => setPlaying((p) => !p), []);
  const stop = useCallback(() => setPlaying(false), []);
  return { playing, toggle, stop };
}

/** Velocidade base estimada a partir do BPM: cada linha dura ~2 compassos. */
export function baseScrollSpeed(
  bpm: number | undefined,
  beatsPerBar: number | undefined,
  fontSize: number,
  showChords: boolean,
): number {
  const b = bpm && bpm > 0 ? bpm : 70;
  const secondsPerLine = (2 * (beatsPerBar || 4) * 60) / b;
  const lineHeightEm = showChords ? 2.8 : 1.5;
  return (lineHeightEm * fontSize) / secondsPerLine;
}

/** Calcula o BPM a partir de toques na tela. */
export function useTapTempo(onBpm: (bpm: number) => void) {
  const taps = useRef<number[]>([]);
  return useCallback(() => {
    const now = performance.now();
    const list = taps.current.filter((t) => now - t < 3000);
    list.push(now);
    taps.current = list.slice(-8);
    if (taps.current.length >= 3) {
      const intervals = taps.current.slice(1).map((t, i) => t - taps.current[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      onBpm(Math.round(60000 / avg));
    }
  }, [onBpm]);
}
