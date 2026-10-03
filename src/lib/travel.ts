import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ScrollFramesEngine } from './scroll-frames';
import type { AnchorIntercept } from './smooth-anchors';

/**
 * Transition de navigation (norme de chaque projet) : tout déplacement qui traverserait la visite (itinéraire,
 * cartes des lieux, logo, liens de l'en-tête et du menu, boutons des chapitres) passe par un fondu vers un voile,
 * un saut direct derrière lui, puis le retour. Défiler jusque-là ferait passer la vidéo en avance rapide
 * (mal de mer). Le voile lui-même (components/TravelVeil.tsx, .vl-veil de villa.css) suit la DA du projet.
 * Fichier commun : à garder identique d'un projet à l'autre.
 */

/** Écart (en progression de la visite) sous lequel on s'y rend en défilant, sans transition */
export const TRAVEL_NEAR = 0.01;
/** Fondu vers le voile (ms) : même durée que la transition de .vl-veil dans villa.css */
export const TRAVEL_FADE_MS = 450;
/** Temps minimal sous le voile (ms), pour lire la destination */
export const TRAVEL_HOLD_MS = 400;

export interface TravelState {
  shown: boolean;
  /** Destination : lieu de la visite ou section de la page */
  label: string;
  /** Petit texte au-dessus (ui.travel) pour un lieu de la visite ; null pour une section */
  kicker: string | null;
  /** Numéro du lieu dans le parcours ; null pour une section */
  num: number | null;
}

type Destination = Omit<TravelState, 'shown'>;

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * @param onStart appelé au début de chaque transition (fermer la fiche ouverte, le menu…)
 * @returns `travel` (état du voile), `toMoment` (aller à un moment de la visite),
 *          `interceptAnchor` (à passer à useSmoothAnchors)
 */
export function useTravel(engineRef: RefObject<ScrollFramesEngine | null>, onStart?: () => void) {
  const [travel, setTravel] = useState<TravelState>({ shown: false, label: '', kicker: null, num: null });
  const busy = useRef(false);
  const startRef = useRef(onStart);
  useEffect(() => {
    startRef.current = onStart;
  });

  /** Fondu vers le voile, saut (`go`, résolu quand l'image d'arrivée est dessinée), puis retour */
  const run = (to: Destination, go: () => Promise<void>, then?: () => void) => {
    if (busy.current) return;
    busy.current = true;
    startRef.current?.();
    setTravel({ ...to, shown: true });
    window.setTimeout(
      () => {
        const hold = new Promise((r) => window.setTimeout(r, TRAVEL_HOLD_MS));
        Promise.all([go(), hold]).then(() => {
          setTravel((v) => ({ ...v, shown: false }));
          then?.();
          busy.current = false;
        });
      },
      reduceMotion() ? 0 : TRAVEL_FADE_MS,
    );
  };

  /** Va à un moment de la visite (0..1, en temps de vidéo) ; tout proche : simple défilement. `then` à l'arrivée. */
  const toMoment = (t: number, to: Destination, then?: () => void) => {
    const engine = engineRef.current;
    if (!engine || busy.current) return;
    if (Math.abs(t - engine.current) < TRAVEL_NEAR) {
      engine.scrollTo(t);
      then?.();
      return;
    }
    run(to, () => engine.jumpTo(t), then);
  };

  /**
   * Liens internes (#section) : transition si le trajet traverse la visite, sinon défilement lisse habituel.
   * Destination affichée : data-travel du lien, sinon son title, sinon son texte.
   */
  const interceptAnchor: AnchorIntercept = (target, link) => {
    const engine = engineRef.current;
    if (!engine) return false;
    if (busy.current) return true;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const to = Math.min(max, Math.max(0, target.getBoundingClientRect().top + window.scrollY));
    const from = window.scrollY;
    const top = engine.section.getBoundingClientRect().top + window.scrollY;
    const end = top + engine.section.offsetHeight - window.innerHeight;
    const crossed = Math.min(Math.max(from, to), end) - Math.max(Math.min(from, to), top);
    if (crossed / Math.max(1, end - top) < TRAVEL_NEAR) return false;
    const label = link.getAttribute('data-travel') ?? link.getAttribute('title') ?? link.textContent?.trim() ?? '';
    run({ label, kicker: null, num: null }, () => {
      window.scrollTo({ top: to, behavior: 'instant' });
      return engine.settle();
    });
    return true;
  };

  return { travel, toMoment, interceptAnchor };
}
