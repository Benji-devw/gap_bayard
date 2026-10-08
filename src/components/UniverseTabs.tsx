import { useRef, type KeyboardEvent } from 'react';
import { asset } from '../lib/asset';
import type { Universe } from '../types';

interface Props {
  items: Universe[];
  /** Univers affiché */
  active: string;
  /** Univers de saison : pastille `nowLabel` sur sa carte */
  now?: string;
  nowLabel: string;
  /** Nom de la liste pour les lecteurs d'écran */
  label: string;
  /** `scroll` : choisi d'un clic (on descend au contenu) ; au clavier, on reste sur les cartes */
  onSelect: (id: string, scroll: boolean) => void;
}

/**
 * Les univers du lieu en grandes cartes photo, sous la visite : des onglets (role="tab"), le contenu de chacun
 * est un tabpanel dont l'id est celui de l'univers. Clavier : flèches gauche / droite, Début, Fin.
 */
export function UniverseTabs({ items, active, now, nowLabel, label, onSelect }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const last = items.length - 1;
    const to =
      e.key === 'ArrowRight'
        ? i === last ? 0 : i + 1
        : e.key === 'ArrowLeft'
          ? i === 0 ? last : i - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : -1;
    if (to < 0) return;
    e.preventDefault();
    onSelect(items[to].id, false);
    refs.current[to]?.focus();
  };

  return (
    <div className="vl-universe-tabs" role="tablist" aria-label={label}>
      {items.map((u, i) => {
        const selected = u.id === active;
        return (
          <button
            key={u.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`tab-${u.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={u.id}
            tabIndex={selected ? 0 : -1}
            className="vl-universe-tab"
            onClick={(e) => onSelect(u.id, e.detail > 0)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="vl-universe-photo">
              <img src={asset(u.image)} alt="" loading="lazy" />
            </span>
            <span className="vl-universe-head">
              <span className="vl-universe-num">{String(i + 1).padStart(2, '0')}</span>
              {u.id === now && <span className="vl-universe-now">{nowLabel}</span>}
            </span>
            <span className="vl-universe-name">{u.label}</span>
            {u.kicker && <span className="vl-universe-kicker">{u.kicker}</span>}
          </button>
        );
      })}
    </div>
  );
}
