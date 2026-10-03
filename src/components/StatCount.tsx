import { useRef } from 'react';
import { useSequenceProgress } from '../lib/scroll-frames';

interface StatCountProps {
  value: number;
  decimals?: number;
  /** Plage de progression de la visite pendant laquelle le chiffre compte, de 0 à sa valeur */
  range: [number, number];
  /** En dessous de cette progression (chapitre masqué, avant son entrée), le chiffre revient à 0 pour recompter au prochain passage */
  resetBelow?: number;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Chiffre qui part de 0 et monte avec le scroll, sans jamais redescendre sous les yeux du visiteur quand il remonte
 * (le compteur du moteur suit le scroll dans les deux sens, d'où un effet « boomerang ») ; revenu avant le chapitre
 * (masqué), il repart de 0 pour recompter au passage suivant.
 * La valeur finale, transparente (et lue par les lecteurs d'écran), réserve la largeur : la ligne de chiffres
 * ne bouge pas pendant le comptage ; le chiffre qui compte est posé dessus.
 * Texte écrit hors React, seulement quand il change.
 */
export function StatCount({ value, decimals = 0, range, resetBelow }: StatCountProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const live = useRef({ reached: 0, text: '' });
  const fmt = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const final = fmt.format(value);

  useSequenceProgress(({ progress }) => {
    const el = ref.current;
    const L = live.current;
    if (!el) return;
    if (resetBelow !== undefined && progress < resetBelow) {
      if (L.reached > 0) {
        L.reached = 0;
        L.text = fmt.format(0);
        el.textContent = L.text;
      }
      return;
    }
    if (L.reached >= 1) return;
    const [a, b] = range;
    const t = Math.min(1, Math.max(0, (progress - a) / Math.max(1e-6, b - a)));
    if (t <= L.reached) return;
    L.reached = t;
    const text = fmt.format(value * easeOut(t));
    if (text !== L.text) {
      L.text = text;
      el.textContent = text;
    }
  });

  return (
    <span className="vl-count">
      <span className="vl-count-final">{final}</span>
      <span ref={ref} className="vl-count-live" aria-hidden="true">
        {fmt.format(0)}
      </span>
    </span>
  );
}
