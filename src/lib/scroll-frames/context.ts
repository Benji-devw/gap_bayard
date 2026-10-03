import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { EngineEvents, ScrollFramesEngine } from './engine';

export const SequenceContext = createContext<ScrollFramesEngine | null>(null);
export const StepContext = createContext<{ in: number; out: number } | null>(null);

/** Moteur de la <ScrollSequence> parente (null pendant le tout premier rendu). */
export function useSequence() {
  return useContext(SequenceContext);
}

/**
 * Appelle `callback` à chaque image rendue, sans provoquer de re-render.
 * Idéal pour piloter une animation maison (Three.js, SVG, audio…).
 */
export function useSequenceProgress(callback: (detail: EngineEvents['progress']) => void) {
  const engine = useSequence();
  const ref = useRef(callback);
  useLayoutEffect(() => {
    ref.current = callback;
  });
  useEffect(() => engine?.on('progress', (d) => ref.current(d)), [engine]);
}

/** État du préchargement, en state React (quelques mises à jour seulement). */
export function useSequenceStatus() {
  const engine = useSequence();
  const [status, setStatus] = useState({
    ready: false,
    loaded: 0,
    total: 0,
    readyProgress: 0,
    bytes: 0,
    indeterminate: false,
    error: false,
  });
  useEffect(() => {
    if (!engine) return;
    const sync = () =>
      setStatus({
        ready: engine.ready,
        loaded: engine.loaded,
        total: engine.count,
        readyProgress: engine.readyProgress,
        bytes: engine.loadedBytes,
        indeterminate: engine.loadIndeterminate,
        error: engine.hasError,
      });
    sync();
    const offs = [engine.on('load', sync), engine.on('ready', sync)];
    return () => offs.forEach((off) => off());
  }, [engine]);
  return status;
}

/**
 * Index du chapitre courant d'après une liste de seuils (ex. [0, 0.2, 0.5]).
 * Ne re-rend le composant que lorsque le chapitre change.
 */
export function useSequenceChapter(stops: readonly number[]) {
  const [index, setIndex] = useState(0);
  useSequenceProgress(({ progress }) => {
    let i = 0;
    stops.forEach((s, k) => {
      if (progress >= s - 0.0005) i = k;
    });
    setIndex(i);
  });
  return index;
}
