import { useState } from 'react';
import { Step } from '../lib/scroll-frames';

interface RotateHintProps {
  /** Progression à laquelle l'invitation apparaît (début de l'accueil : le tutoriel de défilement reste seul avant) */
  from?: number;
  /** Progression à laquelle l'invitation a disparu (fin de l'accueil) */
  until: number;
  label: string;
  close: string;
}

/**
 * Invitation à tourner le téléphone, pendant l'accueil de la visite.
 * Visible seulement sur un téléphone tenu à la verticale (voir .vl-rotate dans villa.css), refermable.
 */
export function RotateHint({ from = 0, until, label, close }: RotateHintProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <Step in={from} out={until} anim="fade" className="vl-rotate" role="note">
      <svg className="vl-rotate-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M11 18h2" />
      </svg>
      <span>{label}</span>
      <button type="button" className="vl-rotate-close" aria-label={close} onClick={() => setDismissed(true)}>
        ×
      </button>
    </Step>
  );
}
