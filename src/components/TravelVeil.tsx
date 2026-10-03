import type { TravelState } from '../lib/travel';

/**
 * Voile de la transition de navigation (logique : lib/travel.ts), variante « Carte de score » : sur toute la page,
 * fondu vers un voile sapin très flou, drapeau au trait qui flotte, « Direction » + le lieu (ou le nom
 * de la section) ; la page et la vidéo sautent derrière au lieu de défiler en accéléré.
 */
export function TravelVeil({ travel }: { travel: TravelState }) {
  return (
    <div className="vl-veil" data-shown={travel.shown ? '' : undefined} aria-hidden="true">
      <span className="vl-veil-flag" />
      <p className="vl-veil-text">
        {travel.kicker && <span className="vl-hand">{travel.kicker}</span>}
        {travel.label}
      </p>
    </div>
  );
}
