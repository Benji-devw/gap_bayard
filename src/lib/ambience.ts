import { useSyncExternalStore } from 'react';

/**
 * Musique d'ambiance de la visite, un seul lecteur par page, partagé entre le bouton son (SoundButton) et le
 * bouton « visite en musique » (MusicPlayButton). Safari n'accepte play() que dans le clic lui-même : les
 * boutons appellent donc startAmbience / stopAmbience directement dans leur gestionnaire de clic, jamais
 * depuis un effet. Le fichier n'est téléchargé qu'au premier lancement.
 */
const listeners = new Set<() => void>();
let audio: HTMLAudioElement | null = null;
let on = false;

function setOn(next: boolean) {
  if (on === next) return;
  on = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** true tant que la musique est demandée (elle peut être en fondu hors de la visite) */
export function useAmbienceOn() {
  return useSyncExternalStore(
    subscribe,
    () => on,
    () => false,
  );
}

/** Le lecteur, une fois créé (fondus, reprise au retour dans la visite) */
export function ambienceAudio() {
  return audio;
}

/** Relance le lecteur ; refusé par le navigateur : la musique repasse à l'arrêt. */
export function resumeAmbience(a: HTMLAudioElement) {
  return a.play().catch((err: unknown) => {
    console.warn('[ambience] lecture refusée par le navigateur :', err);
    setOn(false);
  });
}

/** Lance la musique (à appeler dans le clic) ; `restart` : depuis le début du morceau. Renvoie le lecteur. */
export function startAmbience(src: string, volume: number, restart = false) {
  if (!audio) {
    audio = new Audio(src);
    audio.loop = true;
  }
  audio.muted = false;
  audio.volume = volume;
  if (restart) audio.currentTime = 0;
  void resumeAmbience(audio);
  setOn(true);
  return audio;
}

export function stopAmbience() {
  audio?.pause();
  setOn(false);
}
