import { useEffect, useRef } from 'react';
import { useSequence } from '../lib/scroll-frames';
import { ambienceAudio, resumeAmbience, startAmbience, stopAmbience } from '../lib/ambience';
import { startAutoplay, stopAutoplay, useAutoplay } from '../lib/autoplay';

interface MusicPlayButtonProps {
  /** Musique d'ambiance (même fichier que le bouton son) */
  src: string;
  volume?: number;
  /** Progression de départ de la visite (0 = début ; play.musicOffset positif, converti en part de la vidéo) */
  from?: number;
  /** Seconde de départ du morceau (0 = début ; play.musicOffset négatif) */
  musicStart?: number;
  /** Appelé au lancement (fermer la fiche ouverte) */
  onStart?: () => void;
  /** Texte visible, suivi de la note de musique ♫ (« Visite en ») */
  text: string;
  /** Libellés complets (lecteurs d'écran, infobulle) */
  label: string;
  pauseLabel: string;
}

/** Retard du morceau (s) en dessous duquel on ne le recale pas : inaudible, et un saut coûte plus qu'il n'apporte */
const ALIGN_MIN_S = 0.15;

/**
 * « Visite en musique » : lance ensemble la musique, depuis le début du morceau, et la lecture automatique,
 * depuis le début de la visite, toutes deux dans le clic lui-même (Safari n'accepte le son que là, et une
 * lecture lancée plus tard, hors du clic, n'est pas fiable). Au premier lancement le morceau doit encore
 * arriver : quand il se met enfin à jouer, il est recalé sur le temps déjà écoulé de la visite, pour que
 * musique et visite restent alignées comme si elles étaient parties au même instant. Un second clic arrête
 * les deux. Ensuite chacun vit sa vie : la visite s'arrête comme d'habitude (scroll du visiteur, fiche
 * ouverte, fin), la musique continue en fond pendant la visite (bouton son pour la couper).
 * Page masquée en cours de route (autre bureau ou Space, onglet, fenêtre réduite) : le moteur arrête la vidéo
 * (raison « hidden ») ; la musique se met en pause au même instant, et les deux reprennent ensemble, là où elles
 * en étaient, quand la page redevient visible : la synchronisation est conservée.
 * Lecteur et lecture sont partagés avec SoundButton et PlayButton (lib/ambience.ts, lib/autoplay.ts).
 */
export function MusicPlayButton({ src, volume = 0.5, from = 0, musicStart = 0, onStart, text, label, pauseLabel }: MusicPlayButtonProps) {
  const engine = useSequence();
  const { playing, mode } = useAutoplay();
  const cancelAlign = useRef<(() => void) | null>(null);
  const active = playing && mode === 'music';
  const activeRef = useRef(active);
  activeRef.current = active;
  /** Mis en pause par une page masquée : à reprendre ensemble au retour */
  const resumeOnShow = useRef(false);

  const endAlign = () => {
    cancelAlign.current?.();
    cancelAlign.current = null;
  };

  useEffect(() => endAlign, []);

  useEffect(() => {
    if (!engine) return;
    // la vidéo s'arrête parce que la page est masquée : la musique s'arrête avec elle, pour repartir ensemble
    const off = engine.on('playback', ({ playing: on, reason }) => {
      if (on || reason !== 'hidden' || !activeRef.current) return;
      endAlign();
      ambienceAudio()?.pause();
      resumeOnShow.current = true;
    });
    const onShow = () => {
      if (document.hidden || !resumeOnShow.current) return;
      resumeOnShow.current = false;
      const a = ambienceAudio();
      if (a) void resumeAmbience(a);
      startAutoplay('music', engine.progress);
    };
    document.addEventListener('visibilitychange', onShow);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [engine]);

  const toggle = () => {
    endAlign();
    resumeOnShow.current = false;
    if (active) {
      stopAutoplay();
      stopAmbience();
      return;
    }
    onStart?.();
    const start = performance.now();
    const a = startAmbience(src, volume, true);
    const offset = Math.max(0, musicStart);
    if (offset > 0) a.currentTime = offset; // musique en avance sur les images (play.musicOffset négatif)
    startAutoplay('music', Math.min(0.99, Math.max(0, from)));
    if (a.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return; // morceau déjà là : départ ensemble
    // premier lancement : le morceau arrive ; dès qu'il joue, on le cale sur le temps déjà écoulé de la visite
    const align = () => {
      cancelAlign.current = null;
      const late = (performance.now() - start) / 1000;
      if (late > ALIGN_MIN_S) a.currentTime = offset + late;
    };
    a.addEventListener('playing', align, { once: true });
    cancelAlign.current = () => a.removeEventListener('playing', align);
  };

  const name = active ? pauseLabel : label;
  return (
    <button
      type="button"
      className="vl-music-play"
      aria-pressed={active}
      aria-label={name}
      title={name}
      onClick={toggle}
    >
      {/* texte visible « Visite en ♫ » : la double croche (caractère, agrandie en CSS) tient lieu du mot « musique » */}
      <span className="vl-music-play-label" aria-hidden="true">
        {text}
        <span className="vl-music-play-note">{'♫︎'}</span>
      </span>
    </button>
  );
}
