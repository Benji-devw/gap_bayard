import { useEffect, useState } from 'react';

export type TutorialDevice = 'touch' | 'trackpad' | 'wheel';

interface ScrollTutorialProps {
  /** Texte sous l'icône, pour chaque appareil */
  labels: Record<TutorialDevice, string>;
}

/**
 * Appareil probable : écran tactile (téléphone, tablette), pavé tactile (Mac) ou souris à molette (PC).
 * Un PC portable à pavé tactile reçoit l'indication « molette » : le navigateur ne permet pas de les distinguer
 * avant le premier défilement.
 */
function detectDevice(): TutorialDevice {
  if (typeof window === 'undefined') return 'wheel';
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const noHover = !window.matchMedia('(hover: hover)').matches;
  if (coarse || (navigator.maxTouchPoints > 0 && noHover)) return 'touch';
  return /Mac/i.test(navigator.platform || navigator.userAgent) ? 'trackpad' : 'wheel';
}

/**
 * Tutoriel du début de la visite (norme de chaque projet), à droite et centré en hauteur, affiché pendant
 * l'accueil : main qui glisse vers le haut (tactile), deux doigts vers le haut (pavé tactile), molette
 * vers le bas (souris). Dessiné en SVG, animé en CSS (.vl-tuto de villa.css, restylé selon la DA).
 * Fichier commun : à garder identique d'un projet à l'autre.
 */
export function ScrollTutorial({ labels }: ScrollTutorialProps) {
  const [device, setDevice] = useState<TutorialDevice>('wheel');

  useEffect(() => {
    setDevice(detectDevice());
    // écran tactile sur un ordinateur hybride : on bascule sur la main au premier toucher
    const onTouch = () => setDevice('touch');
    window.addEventListener('touchstart', onTouch, { once: true, passive: true });
    return () => window.removeEventListener('touchstart', onTouch);
  }, []);

  return (
    <div className="vl-tuto-inner" data-device={device}>
      <svg className="vl-tuto-icon" viewBox="0 0 48 64" aria-hidden="true">
        {device === 'touch' && (
          <>
            <path className="vl-tuto-chevron" d="M18 9l6-6 6 6" />
            <path className="vl-tuto-trail" d="M24 14v22" />
            <g className="vl-tuto-move">
              <path d="M20 43V35a2.5 2.5 0 0 1 5 0v7M25 41a2.5 2.5 0 0 1 5 0v1.5M30 42.5a2.5 2.5 0 0 1 5 0V47a9 9 0 0 1-9 9h-2a9 9 0 0 1-6.8-3.1l-4.4-5.1a2.2 2.2 0 0 1 3.3-2.9l3.9 3.9" />
            </g>
          </>
        )}
        {device === 'trackpad' && (
          <>
            <path className="vl-tuto-chevron" d="M18 9l6-6 6 6" />
            <rect x="6" y="16" width="36" height="44" rx="7" />
            <g className="vl-tuto-move">
              <ellipse className="vl-tuto-finger" cx="19" cy="46" rx="3.6" ry="4.6" />
              <ellipse className="vl-tuto-finger" cx="29" cy="46" rx="3.6" ry="4.6" />
            </g>
          </>
        )}
        {device === 'wheel' && (
          <>
            <rect x="13" y="4" width="22" height="36" rx="11" />
            <path className="vl-tuto-wheel" d="M24 11v6" />
            <path className="vl-tuto-chevron vl-tuto-down" d="M18 48l6 6 6-6" />
          </>
        )}
      </svg>
      <span className="vl-tuto-label">{labels[device]}</span>
    </div>
  );
}
