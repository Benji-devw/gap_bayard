import { useEffect, useRef, useState } from 'react';
import { useSequence } from '../lib/scroll-frames';
import { ambienceAudio, resumeAmbience, startAmbience, stopAmbience, useAmbienceOn } from '../lib/ambience';

interface SoundButtonProps {
  src: string;
  /** Volume de la musique, 0..1 */
  volume?: number;
  label: string;
  offLabel: string;
}

const FADE_MS = 700;

/**
 * Musique d'ambiance de la visite, coupée par défaut (les navigateurs bloquent le son automatique).
 * Téléchargée au premier clic seulement ; elle ne joue que pendant la visite (section à l'écran, onglet actif) :
 * fondu de sortie quand on descend vers les sections du bas, reprise quand on revient.
 * Sur iPhone, le volume n'est pas réglable : la musique se coupe sans fondu.
 * Le lecteur est partagé (lib/ambience.ts) : le bouton « visite en musique » peut aussi la lancer ou l'arrêter.
 */
export function SoundButton({ src, volume = 0.5, label, offLabel }: SoundButtonProps) {
  const engine = useSequence();
  const fade = useRef(0);
  const on = useAmbienceOn();
  const [inTour, setInTour] = useState(true);

  // la visite est-elle à l'écran ? (même principe que l'en-tête : position de la section au scroll)
  useEffect(() => {
    const section = engine?.section;
    if (!section) return;
    const check = () => {
      const r = section.getBoundingClientRect();
      setInTour(r.bottom > window.innerHeight * 0.5 && r.top < window.innerHeight * 0.5);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [engine]);

  /** Volume vers `to` en FADE_MS ; à 0, la musique est mise en pause. */
  const fadeTo = (a: HTMLAudioElement, to: number) => {
    clearInterval(fade.current);
    const from = a.volume;
    const start = performance.now();
    fade.current = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - start) / FADE_MS);
      a.volume = from + (to - from) * k;
      if (k < 1) return;
      clearInterval(fade.current);
      if (to === 0) a.pause();
    }, 30);
  };

  // sortie / retour dans la visite, onglet masqué / visible
  useEffect(() => {
    const a = ambienceAudio();
    if (!a || !on) return;
    const sync = () => {
      if (inTour && !document.hidden) {
        if (a.paused) void resumeAmbience(a);
        fadeTo(a, volume);
      } else {
        fadeTo(a, 0);
      }
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [on, inTour, volume]);

  useEffect(
    () => () => {
      clearInterval(fade.current);
      ambienceAudio()?.pause();
    },
    [],
  );

  const toggle = () => {
    clearInterval(fade.current);
    if (on) {
      stopAmbience();
      return;
    }
    // son réglé tout de suite, et play() dans le clic lui-même (obligatoire sur Safari)
    startAmbience(src, volume);
  };

  const text = on ? offLabel : label;
  return (
    <button type="button" className="vl-sound" aria-pressed={on} aria-label={text} title={text} onClick={toggle}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        {on ? (
          <path className="vl-sound-waves" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
        ) : (
          <path d="M16 9.5l5 5M21 9.5l-5 5" />
        )}
      </svg>
    </button>
  );
}
