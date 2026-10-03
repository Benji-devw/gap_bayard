import { useSyncExternalStore } from 'react';

/**
 * Lecture automatique de la visite, partagée entre le bouton lecture (PlayButton, qui la conduit) et le bouton
 * « visite en musique » (MusicPlayButton, qui la lance avec la musique). Changée seulement au clic et à l'arrêt :
 * jamais à chaque image.
 * - `mode` : 'music' quand elle a été lancée avec la musique (le bouton « visite en musique » s'affiche en lecture) ;
 * - `from` : progression de départ imposée (0 = début de la visite), sinon PlayButton part de l'endroit où l'on est.
 */
export type AutoplayMode = 'plain' | 'music';

export interface AutoplayState {
  playing: boolean;
  mode: AutoplayMode;
  from: number | null;
}

const IDLE: AutoplayState = { playing: false, mode: 'plain', from: null };
const listeners = new Set<() => void>();
let state = IDLE;

function set(next: AutoplayState) {
  state = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useAutoplay() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => IDLE,
  );
}

export function startAutoplay(mode: AutoplayMode, from: number | null = null) {
  set({ playing: true, mode, from });
}

export function stopAutoplay() {
  if (state.playing) set(IDLE);
}
