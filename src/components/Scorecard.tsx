import { asset } from '../lib/asset';
import type { UiText, VillaData } from '../types';

type Holes = NonNullable<VillaData['sections']['holes']>;
type Hole = Holes['items'][number];

interface ScorecardProps {
  holes: Holes;
  ui: UiText;
}

const sum = (list: Hole[]) => list.reduce((total, h) => total + h.par, 0);

/** Une moitié de la carte (aller ou retour) : numéros, par, handicap, puis le sous-total (et le total sur le retour) */
function Half({ list, label, total, ui }: { list: Hole[]; label: string; total?: number; ui: UiText }) {
  const hasHcp = list.some((h) => h.hcp !== undefined);
  return (
    <table className="vl-card">
      <thead>
        <tr>
          <th scope="row">{ui.holesHole}</th>
          {list.map((h) => (
            <th key={h.number} scope="col">
              {h.number}
            </th>
          ))}
          <th scope="col" className="vl-card-sum">
            {label}
          </th>
          {total !== undefined && (
            <th scope="col" className="vl-card-sum">
              {ui.holesTotal}
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">{ui.holesPar}</th>
          {list.map((h) => (
            <td key={h.number} data-par={h.par}>
              {h.par}
            </td>
          ))}
          <td className="vl-card-sum">{sum(list)}</td>
          {total !== undefined && <td className="vl-card-sum">{total}</td>}
        </tr>
        {hasHcp && (
          <tr className="vl-card-hcp">
            <th scope="row">{ui.holesHcp}</th>
            {list.map((h) => (
              <td key={h.number}>{h.hcp ?? ''}</td>
            ))}
            <td className="vl-card-sum" />
            {total !== undefined && <td className="vl-card-sum" />}
          </tr>
        )}
      </tbody>
    </table>
  );
}

/**
 * Carte de score du parcours : l'aller (trous 1 à 9) et le retour (10 à 18) en deux tableaux,
 * par et handicap de chaque trou, sous-totaux et total ; puis les plans des trous, en bande défilante.
 */
export function Scorecard({ holes, ui }: ScorecardProps) {
  const items = [...holes.items].sort((a, b) => a.number - b.number);
  const front = items.slice(0, 9);
  const back = items.slice(9);
  const plans = items.filter((h) => h.image);
  return (
    <>
      <div className="vl-card-wrap">
        <Half list={front} label={ui.holesOut} ui={ui} />
        {back.length > 0 && <Half list={back} label={ui.holesIn} total={sum(items)} ui={ui} />}
      </div>
      {plans.length > 0 && (
        <ul className="vl-plans">
          {plans.map((h) => (
            <li key={h.number}>
              <figure>
                <img src={asset(h.image as string)} alt="" loading="lazy" width={520} height={332} />
                <figcaption>
                  {ui.holesPlan.replace('{n}', String(h.number)).replace('{par}', String(h.par))}
                  {h.hcp !== undefined && (
                    <span>
                      {ui.holesHcp} {h.hcp}
                    </span>
                  )}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
