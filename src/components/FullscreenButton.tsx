import { useEffect, useRef, useState } from 'react';
import { useFullscreen } from '../lib/fullscreen';
import { useSequence } from '../lib/scroll-frames';

interface FullscreenButtonProps {
  label: string;
  exitLabel: string;
  /**
   * Bulle d'invitation affichée au-dessus du bouton quand un téléphone passe à l'horizontale (norme) :
   * « Touchez pour passer en plein écran ». Absente = pas de bulle.
   */
  hint?: string;
}

/** Durée d'affichage de la bulle d'invitation (ms) */
const HINT_MS = 9000;

/**
 * Bouton plein écran de la visite (commandes en bas au centre). Toujours affiché : API Fullscreen quand le
 * navigateur l'offre, sinon (Safari sur iPhone) mode immersif de lib/fullscreen.ts.
 * Téléphone tourné à l'horizontale : bulle d'invitation et bouton qui pulse, jusqu'au plein écran,
 * au toucher, ou pendant HINT_MS ; plus rien une fois que le visiteur a utilisé le bouton.
 * Tourné pendant le chargement : la bulle attend que la visite soit affichée (sinon ses HINT_MS
 * s'écoulent sous l'écran de chargement et le visiteur ne la voit jamais).
 */
export function FullscreenButton({ label, exitLabel, hint }: FullscreenButtonProps) {
  const { active, mode, toggle: toggleFullscreen } = useFullscreen();
  const [invite, setInvite] = useState(false);
  const used = useRef(false);

  // visite affichée (écran de chargement parti) : seul l'événement « ready » compte, pas la progression
  const engine = useSequence();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!engine) return;
    setReady(engine.ready);
    return engine.on('ready', () => setReady(true));
  }, [engine]);

  useEffect(() => {
    if (active) {
      used.current = true;
      setInvite(false);
    }
  }, [active]);

  // téléphone tourné à l'horizontale (ou déjà couché quand la visite s'affiche) : invitation au plein écran
  useEffect(() => {
    if (!hint || !ready) return;
    const landscape = window.matchMedia('(orientation: landscape)');
    const touch = window.matchMedia('(pointer: coarse)');
    let timer = 0;
    const check = () => {
      window.clearTimeout(timer);
      const show = touch.matches && landscape.matches && !document.fullscreenElement && !used.current;
      setInvite(show);
      if (show) timer = window.setTimeout(() => setInvite(false), HINT_MS);
    };
    check();
    landscape.addEventListener('change', check);
    return () => {
      landscape.removeEventListener('change', check);
      window.clearTimeout(timer);
    };
  }, [hint, ready]);

  const toggle = () => {
    used.current = true;
    setInvite(false);
    toggleFullscreen();
  };

  const text = active ? exitLabel : label;
  return (
    <span className="vl-fs-wrap">
      {invite && hint && (
        <span className="vl-fs-hint" role="status" onClick={toggle}>
          {hint}
        </span>
      )}
      <button
        type="button"
        className="vl-fullscreen"
        data-invite={invite || undefined}
        data-mode={mode}
        aria-pressed={active}
        onClick={toggle}
        aria-label={text}
        title={text}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={active ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'} />
        </svg>
      </button>
    </span>
  );
}
