import { useEffect, useRef, useState } from 'react';
import { cx } from '../lib/scroll-frames';
import type { Review, UiText, VillaData } from '../types';

type ReviewsSection = NonNullable<VillaData['sections']['reviews']>;

/** Réponse de la fonction `api/reviews.js` (avis Google du lieu, via l'API Places). */
interface RemoteReviews {
  source: 'google';
  rating: number | null;
  count: number;
  url: string | null;
  items: Review[];
}

const STAR = 'M12 3.6l2.55 5.2 5.75.84-4.15 4.05.98 5.72L12 16.72l-5.13 2.69.98-5.72L3.7 9.64l5.75-.84z';

function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="vl-stars" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 24 24" aria-hidden="true" className={i <= Math.round(value) ? 'is-on' : undefined}>
          <path d={STAR} />
        </svg>
      ))}
    </span>
  );
}

interface ReviewsProps {
  section: ReviewsSection;
  /** Lieu du bien (clé `map`) : lien « Voir les avis sur Google » */
  mapQuery?: string;
  lang?: string;
  ui: UiText;
  className?: string;
  /** Liste en carrousel horizontal, avec flèches précédent / suivant (Villa Azur) */
  carousel?: boolean;
}

const ARROW = { prev: 'M14.5 6l-6 6 6 6', next: 'M9.5 6l6 6-6 6' };

/**
 * Section « avis ». Deux sources :
 * - `section.items` (JSON) : avis saisis à la main. `sample: true` = avis d'exemple, signalés comme tels, sans lien Google ;
 * - `section.api` : adresse de la fonction serveur qui renvoie les vrais avis Google (voir api/reviews.js).
 *   En cas d'échec (ou en développement, sans la fonction), les avis du JSON restent affichés.
 */
export function Reviews({ section, mapQuery, lang = 'fr', ui, className, carousel = false }: ReviewsProps) {
  const [remote, setRemote] = useState<RemoteReviews | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  // carrousel : flèches désactivées aux extrémités (au scroll, au redimensionnement, quand les avis changent)
  useEffect(() => {
    const list = listRef.current;
    if (!carousel || !list) return;
    const check = () =>
      setEdges({ start: list.scrollLeft < 4, end: list.scrollLeft + list.clientWidth > list.scrollWidth - 4 });
    check();
    list.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      list.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [carousel, remote]);

  const scrollByCard = (dir: 1 | -1) => {
    const list = listRef.current;
    const card = list?.querySelector('li');
    if (!list || !card) return;
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    list.scrollBy({ left: dir * (card.getBoundingClientRect().width + gap), behavior: reduce ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    if (!section.api) return;
    const ctrl = new AbortController();
    const url = `${section.api}${section.api.includes('?') ? '&' : '?'}lang=${encodeURIComponent(lang)}`;
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: RemoteReviews) => {
        if (d?.items?.length) setRemote(d);
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) console.warn('[Reviews] avis de l’API indisponibles, avis du JSON affichés :', err);
      });
    return () => ctrl.abort();
  }, [section.api, lang]);

  const items = remote?.items ?? section.items;
  if (!items.length) return null;

  const fromGoogle = remote !== null;
  const sample = !fromGoogle && section.sample;
  const average = remote?.rating ?? items.reduce((sum, r) => sum + r.rating, 0) / items.length;
  const total = remote?.count || items.length;
  const fmt = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ratingLabel = (n: number) => ui.reviewsRating.replace('{rating}', fmt.format(n));
  const mapsUrl =
    remote?.url ?? (mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : null);

  return (
    <section id="avis" className={cx(className, fromGoogle && 'is-google')}>
      <div className="vl-reviews-head">
        <div className="vl-section-head">
          {section.kicker && <p className="vl-kicker">{section.kicker}</p>}
          <h2>{section.title}</h2>
          {section.note && <p className="vl-hand vl-section-note">{section.note}</p>}
          {section.text && <p className="vl-lead">{section.text}</p>}
        </div>
        <div className="vl-reviews-score">
          {fromGoogle && <span className="vl-reviews-source">{ui.reviewsGoogle}</span>}
          <strong>{fmt.format(average)}</strong>
          <Stars value={average} label={ratingLabel(average)} />
          <span className="vl-reviews-count">{ui.reviewsCount.replace('{count}', String(total))}</span>
          {sample ? (
            <p className="vl-reviews-sample">{ui.reviewsSample}</p>
          ) : (
            mapsUrl && (
              <a className="vl-reviews-link" href={mapsUrl} target="_blank" rel="noopener">
                {ui.reviewsLink}
              </a>
            )
          )}
          {carousel && items.length > 1 && (
            <div className="vl-reviews-nav">
              {(['prev', 'next'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-label={d === 'prev' ? ui.reviewsPrev : ui.reviewsNext}
                  aria-controls="vl-reviews-list"
                  disabled={d === 'prev' ? edges.start : edges.end}
                  onClick={() => scrollByCard(d === 'prev' ? -1 : 1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={ARROW[d]} />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ul ref={listRef} id="vl-reviews-list" className={cx('vl-reviews', carousel && 'is-carousel')}>
        {items.map((r, i) => (
          <li key={`${r.name}-${r.date}-${i}`} className="vl-review">
            <Stars value={r.rating} label={ratingLabel(r.rating)} />
            <blockquote>
              <p>{r.text}</p>
            </blockquote>
            <p className="vl-review-author">
              {r.photo ? (
                <img className="vl-review-avatar" src={r.photo} alt="" loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <span className="vl-review-avatar" aria-hidden="true">
                  {r.name.charAt(0)}
                </span>
              )}
              <span>
                {r.profile ? (
                  <a href={r.profile} target="_blank" rel="noopener">
                    <strong>{r.name}</strong>
                  </a>
                ) : (
                  <strong>{r.name}</strong>
                )}
                <span>{[r.origin, r.date].filter(Boolean).join(' · ')}</span>
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
