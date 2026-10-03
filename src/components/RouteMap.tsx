import { useMemo, useRef } from 'react';
import { useSequenceProgress } from '../lib/scroll-frames';
import type { Hotspot } from '../types';
import { effectiveTrack } from '../utils';

interface RouteMapProps {
  hotspots: Hotspot[];
  title: string;
  onSelect: (hotspot: Hotspot) => void;
}

/** Marge (en progression) avant la première pièce, à partir de laquelle l'itinéraire s'affiche (puis jusqu'à la fin de la visite) */
const MARGIN = 0.03;

/**
 * Itinéraire de la visite, en capsule de verre (voir villa.css) : les lieux dans l'ordre du parcours,
 * le lieu en cours mis en avant. Mis à jour hors React à chaque image ; un clic amène à la pièce.
 */
export function RouteMap({ hotspots, title, onSelect }: RouteMapProps) {
  const root = useRef<HTMLElement>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const ranges = useMemo(
    () =>
      hotspots.map((h) => {
        const track = effectiveTrack(h);
        return [track[0]?.[0] ?? 0, track[track.length - 1]?.[0] ?? 0] as const;
      }),
    [hotspots],
  );

  useSequenceProgress(({ progress }) => {
    const el = root.current;
    if (!el || !ranges.length) return;
    // affiché dès la première pièce et jusqu'à la fin de la visite, même après la dernière étape (toutes cochées)
    const visible = progress >= ranges[0][0] - MARGIN;
    if (el.hasAttribute('data-visible') !== visible) {
      el.toggleAttribute('data-visible', visible);
      el.inert = !visible;
    }
    ranges.forEach(([from, to], i) => {
      const li = items.current[i];
      if (!li) return;
      li.toggleAttribute('data-active', progress >= from && progress <= to);
      li.toggleAttribute('data-done', progress > to);
    });
  });

  if (!hotspots.length) return null;

  return (
    <nav ref={root} className="vl-route" aria-label={title} inert>
      <p className="vl-route-title">{title}</p>
      <ol>
        {hotspots.map((h, i) => (
          <li
            key={h.id}
            ref={(el) => {
              items.current[i] = el;
            }}
          >
            <button type="button" onClick={() => onSelect(h)}>
              <span className="vl-route-num">{i + 1}</span>
              <span className="vl-route-label">{h.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
