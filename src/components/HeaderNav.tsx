import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { cx } from '../lib/scroll-frames';
import { asset } from '../lib/asset';
import type { NavItem } from '../types';

interface Props {
  items: NavItem[];
  /** En-tête rangé (plein écran) ou menu burger ouvert : panneaux fermés */
  disabled?: boolean;
  /** `sub` : bouton qui ouvre les sous-catégories ({label}) ; `all` : lien vers toute la catégorie */
  labels: { sub: string; all: string };
}

/** Délai avant de fermer un panneau quand la souris le quitte (traversée de l'espace entre le lien et le panneau) */
const CLOSE_DELAY = 160;

/**
 * Menu de l'en-tête (ordinateur) : une entrée avec sous-catégories ouvre un panneau pleine largeur sous l'en-tête
 * (photo, phrase, sous-catégories numérotées). Souris : au survol ; clavier et écran tactile : bouton chevron
 * (aria-expanded). Échap ferme et rend la main au bouton, un clic ailleurs ferme, le panneau fermé est inerte.
 */
export function HeaderNav({ items, disabled, labels }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const toggles = useRef<(HTMLButtonElement | null)[]>([]);
  const timer = useRef(0);

  useEffect(() => {
    if (disabled) setOpen(null);
  }, [disabled]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      toggles.current[open]?.focus();
      setOpen(null);
    };
    const onDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const hoverIn = (i: number, e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse' || disabled) return;
    window.clearTimeout(timer.current);
    setOpen(i);
  };
  const hoverOut = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(null), CLOSE_DELAY);
  };
  const close = () => setOpen(null);

  return (
    <nav ref={navRef} className="vl-nav">
      <ul className="vl-nav-list">
        {items.map((item, i) => {
          const sub = item.children && item.children.length > 0 ? item.children : null;
          const isOpen = open === i;
          return (
            <li
              key={item.href}
              className={cx('vl-nav-item', isOpen && 'is-open')}
              onPointerEnter={sub ? (e) => hoverIn(i, e) : undefined}
              onPointerLeave={sub ? hoverOut : undefined}
              onBlur={(e) => {
                // le focus quitte l'entrée et son panneau (Tab au-delà) : on ferme
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen((o) => (o === i ? null : o));
              }}
            >
              <a className="vl-nav-top" href={item.href} onClick={close}>
                {item.label}
              </a>
              {sub && (
                <>
                  <button
                    ref={(el) => {
                      toggles.current[i] = el;
                    }}
                    type="button"
                    className="vl-nav-toggle"
                    aria-expanded={isOpen}
                    aria-controls={`vl-sub-${i}`}
                    aria-label={(labels.sub ?? '{label}').replace('{label}', item.label)}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    <svg viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M2.5 4.5 6 8l3.5-3.5" />
                    </svg>
                  </button>
                  <div id={`vl-sub-${i}`} className="vl-sub" inert={!isOpen}>
                    <div className="vl-sub-inner">
                      {item.image && (
                        <figure className="vl-sub-photo">
                          <img src={asset(item.image)} alt="" loading="lazy" />
                        </figure>
                      )}
                      <div className="vl-sub-intro">
                        {item.kicker && <p className="vl-sub-kicker">{item.kicker}</p>}
                        <p className="vl-sub-title">{item.label}</p>
                        {item.text && <p className="vl-sub-text">{item.text}</p>}
                        <a className="vl-link" href={item.href} data-travel={item.label} onClick={close}>
                          {labels.all ?? item.label}
                        </a>
                      </div>
                      <ol className="vl-sub-list">
                        {sub.map((c, k) => (
                          <li key={c.href} style={{ '--k': k } as CSSProperties}>
                            <a href={c.href} onClick={close}>
                              <span className="vl-sub-num">{String(k + 1).padStart(2, '0')}</span>
                              <span className="vl-sub-name">{c.label}</span>
                              {c.note && <span className="vl-sub-note">{c.note}</span>}
                            </a>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
