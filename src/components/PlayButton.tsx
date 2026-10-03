import { useEffect, useMemo } from 'react';
import { useSequence } from '../lib/scroll-frames';
import { startAutoplay, stopAutoplay, useAutoplay } from '../lib/autoplay';

interface PlayButtonProps {
  /** Durée de la visite entière en lecture automatique, en secondes */
  duration: number;
  /** Rythme et ralentis du scroll (media.pace, media.slowdowns) */
  pace?: number[];
  slowdowns?: { from: number; to: number; factor: number }[];
  /** Part du rythme du scroll suivie par la lecture : 0 = vidéo à vitesse régulière, 1 = exactement comme au scroll */
  follow?: number;
  /** Arrête la lecture (fiche d'un lieu ouverte) */
  hold?: boolean;
  /** Appelé au lancement de la lecture (fermer la fiche ouverte) */
  onStart?: () => void;
  label: string;
  pauseLabel: string;
}

/** Écart (px) entre la position voulue et la position réelle au-delà duquel le visiteur a repris la main */
const TOLERANCE = 3;
/** Finesse de la table des vitesses */
const SAMPLES = 1000;

/**
 * Vitesse de lecture en chaque point de la vidéo (en progression par seconde), d'après le rythme du scroll
 * adouci par `follow` : au scroll, un lieu prend jusqu'à 8 fois plus de place qu'un trajet ; en lecture,
 * suivre ce rythme à la lettre fait filer les trajets et traîner les lieux.
 */
function buildSpeeds(duration: number, follow: number, pace: number[] = [], slowdowns: PlayButtonProps['slowdowns'] = []) {
  const weight = (m: number) => {
    let w = pace.length ? pace[Math.min(pace.length - 1, Math.floor(m * pace.length))] : 1;
    if (!Number.isFinite(w) || w <= 0) w = 1;
    for (const z of slowdowns) if (m >= z.from && m < z.to) w *= Math.max(0.05, z.factor);
    return Math.pow(w, follow);
  };
  const weights = Array.from({ length: SAMPLES }, (_, i) => weight((i + 0.5) / SAMPLES));
  const total = weights.reduce((a, b) => a + b, 0) / SAMPLES;
  return weights.map((w) => 1 / (Math.max(5, duration) * (w / total)));
}

/**
 * Lecture automatique de la visite, de l'endroit où l'on est jusqu'à la fin (depuis le début si l'on est déjà à la fin).
 * Vidéo : lecture native par le moteur (engine.startPlayback), décodage séquentiel fluide, la page suit la vidéo.
 * Séquence d'images : on avance dans la progression et on fait défiler la page (engine.scrollTo).
 * Chapitres, points et itinéraire restent synchronisés comme au scroll.
 * S'arrête dès que le visiteur fait défiler lui-même, ouvre une fiche ou arrive à la fin.
 * État partagé (lib/autoplay.ts) : le bouton « visite en musique » la lance aussi, depuis le début (`from`).
 * En visite en musique, la vidéo est lue à vitesse normale (×1) : le montage est calé sur le morceau en temps
 * réel, le rythme du scroll (pace, ralentis, duration) ne s'applique pas.
 */
export function PlayButton({ duration, pace, slowdowns, follow = 0.35, hold, onStart, label, pauseLabel }: PlayButtonProps) {
  const engine = useSequence();
  const { playing, mode, from: requested } = useAutoplay();
  const speeds = useMemo(
    () => buildSpeeds(duration, Math.min(1, Math.max(0, follow)), pace, slowdowns),
    [duration, follow, pace, slowdowns],
  );

  useEffect(() => {
    if (hold) stopAutoplay();
  }, [hold]);

  useEffect(() => {
    if (!playing || !engine) return;
    const before = engine.section.getBoundingClientRect().top > 0;
    const from = requested ?? (before || engine.progress >= 0.995 ? 0 : engine.progress);
    // visite en musique : temps réel (×1), comme le montage calé sur le morceau ; sinon le rythme du scroll adouci
    const realtime = mode === 'music' && engine.videoDuration > 0 ? 1 / engine.videoDuration : 0;
    const speedAt = realtime ? () => realtime : (m: number) => speeds[Math.min(SAMPLES - 1, Math.floor(m * SAMPLES))];

    // vidéo : lecture native (fluide sur téléphone), le moteur fait défiler la page et prévient quand ça s'arrête
    if (engine.startPlayback(from, speedAt)) {
      const off = engine.on('playback', ({ playing: on }) => {
        if (!on) stopAutoplay();
      });
      return () => {
        off();
        engine.stopPlayback();
      };
    }

    // séquence d'images : on avance nous-mêmes et on fait défiler la page (engine.scrollTo)
    let m = from;
    let expected = -1;
    let last = 0;
    let raf = 0;
    const step = (now: number) => {
      // le visiteur a fait défiler lui-même (molette, doigt, clavier, barre de défilement) : il reprend la main
      if (expected >= 0 && Math.abs(window.scrollY - expected) > TOLERANCE) {
        stopAutoplay();
        return;
      }
      const dt = last ? Math.min(64, now - last) / 1000 : 0;
      last = now;
      m = Math.min(1, m + dt * speedAt(m));
      engine.scrollTo(m, 'instant');
      expected = window.scrollY;
      if (m >= 1) {
        stopAutoplay();
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, mode, requested, engine, speeds]);

  const toggle = () => {
    if (playing) {
      stopAutoplay();
      return;
    }
    onStart?.();
    startAutoplay('plain');
  };

  const text = playing ? pauseLabel : label;
  return (
    <button type="button" className="vl-play" aria-pressed={playing} aria-label={text} title={text} onClick={toggle}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {playing ? <path d="M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z" /> : <path d="M8.5 5.8v12.4a.8.8 0 0 0 1.2.7l9.6-6.2a.8.8 0 0 0 0-1.4L9.7 5.1a.8.8 0 0 0-1.2.7z" />}
      </svg>
    </button>
  );
}
