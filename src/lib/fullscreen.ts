import { useCallback, useSyncExternalStore } from 'react';

/**
 * Plein écran de la visite (bouton en bas à droite, en-tête rangé).
 * - `native` : API Fullscreen du navigateur (ordinateur, Android, iPad).
 * - `soft` : Safari sur iPhone n'accepte le plein écran que pour une vidéo native ; à la place, un mode
 *   « immersif » maison : la page reçoit l'attribut data-immersive, l'en-tête se range comme en vrai plein
 *   écran et Safari replie ses propres barres au défilement. Aussi utilisé si le navigateur refuse la demande
 *   (iframe sans autorisation, réglage).
 * État partagé entre le bouton et la page (un seul plein écran par page), sans re-render pendant le scroll.
 */
export type FullscreenMode = 'native' | 'soft';

const listeners = new Set<() => void>();
let soft = false;

function subscribe(fn: () => void) {
  listeners.add(fn);
  document.addEventListener('fullscreenchange', fn);
  return () => {
    listeners.delete(fn);
    document.removeEventListener('fullscreenchange', fn);
  };
}

const nativeSupported = () => typeof document !== 'undefined' && Boolean(document.fullscreenEnabled);
const isActive = () => Boolean(document.fullscreenElement) || soft;

function setSoft(on: boolean) {
  if (soft === on) return;
  soft = on;
  document.documentElement.toggleAttribute('data-immersive', on);
  listeners.forEach((fn) => fn());
}

export function useFullscreen() {
  const active = useSyncExternalStore(subscribe, isActive, () => false);
  const mode: FullscreenMode = nativeSupported() ? 'native' : 'soft';
  const toggle = useCallback(() => {
    if (mode === 'soft') {
      setSoft(!soft);
      return;
    }
    const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    request.catch(() => setSoft(!soft)); // refusé par le navigateur : mode immersif à la place
  }, [mode]);
  return { active, mode, toggle };
}
