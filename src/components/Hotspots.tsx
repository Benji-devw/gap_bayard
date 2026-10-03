import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cx, useSequence, useSequenceProgress } from '../lib/scroll-frames';
import { asset } from '../lib/asset';
import { SHEET_QUERY } from '../lib/media';
import type { Hotspot, UiText } from '../types';
import { effectiveTrack, sampleTrack, trackRuns, type TrackSample } from '../utils';

interface HotspotsProps {
  hotspots: Hotspot[];
  gap: number;
  zoom: number;
  ui: UiText;
  openId: string | null;
  onOpenChange: (id: string | null) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
/** Points rangés en bas au centre : hauteur depuis le bas de l'écran (fraction) et écart entre deux points */
const DOCK_BOTTOM = 0.3;
const DOCK_STEP = 170;
/** Fiche à côté du point (ordinateur) : marges hautes (sous l'en-tête) et basses (au-dessus des commandes de la visite) */
const POP_TOP = 88;
const POP_BOTTOM = 112;
const isSheet = () => matchMedia(SHEET_QUERY).matches;

/**
 * Points numérotés sur les pièces de la vidéo + fiche de la pièce.
 * Les positions sont mises à jour hors React à chaque image ; seules la pièce « en vedette »
 * (la plus proche du centre) et la fiche ouverte passent par le state.
 */
export function Hotspots({ hotspots, gap, zoom, ui, openId, onOpenChange }: HotspotsProps) {
  const engine = useSequence();
  const layerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const cropRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const live = useRef({
    openId,
    shown: false,
    onOpenChange,
    samples: new Map<string, TrackSample>(),
    screen: new Map<string, { x: number; y: number }>(),
    /** Dernier style écrit par point : on n'écrit dans le DOM que ce qui change */
    styles: new Map<string, string>(),
    featured: null as string | null,
    /** Taille du calque et du popup gardées en cache : aucune lecture du DOM à chaque image */
    W: 0,
    H: 0,
    popW: 0,
    popH: 0,
    /** Image de la vidéo déjà recadrée dans le popup */
    cropFrame: -1,
  });
  const [featured, setFeatured] = useState<string | null>(null);
  const runs = useMemo(
    () => new Map(hotspots.map((h) => [h.id, trackRuns(effectiveTrack(h), h.track && h.track.length > 1 ? gap : Infinity)])),
    [hotspots, gap],
  );
  const open = hotspots.find((h) => h.id === openId) ?? null;
  // fermeture animée : la fiche qui vient de se fermer reste affichée le temps de l'animation inverse
  // (même élément, donc même position), puis disparaît ; une autre fiche ouverte entre-temps la remplace
  const [prevOpenId, setPrevOpenId] = useState(openId);
  const [closing, setClosing] = useState<Hotspot | null>(null);
  if (openId !== prevOpenId) {
    setPrevOpenId(openId);
    setClosing(openId === null ? (hotspots.find((h) => h.id === prevOpenId) ?? null) : null);
  }
  const shown = open ?? closing;
  // filet de sécurité si l'animation ne joue pas (mouvements réduits) : retirée un peu après sa durée
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setClosing(null), 700);
    return () => window.clearTimeout(timer);
  }, [closing]);

  useLayoutEffect(() => {
    live.current.onOpenChange = onOpenChange;
  });

  const positionPopup = (id: string) => {
    const pop = popupRef.current;
    const layer = layerRef.current;
    const L = live.current;
    const p = L.screen.get(id);
    if (!pop || !layer || !p) return;
    if (!pop.hasAttribute('data-shown')) pop.setAttribute('data-shown', '');
    if (isSheet()) {
      if (pop.style.transform) pop.style.transform = '';
      return;
    }
    // taille du popup mesurée une fois à l'ouverture (et au redimensionnement), pas à chaque image
    if (!L.popW) {
      L.popW = pop.offsetWidth;
      L.popH = pop.offsetHeight;
    }
    const { W, H, popW, popH } = L;
    const right = p.x < W * 0.56;
    const x = clamp(right ? p.x + 30 : p.x - 30 - popW, 16, W - popW - 16);
    const y = clamp(p.y - popH / 2, POP_TOP, Math.max(POP_TOP, H - popH - POP_BOTTOM));
    pop.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    const side = right ? 'right' : 'left';
    if (pop.dataset.side !== side) pop.dataset.side = side;
  };

  /** Zoom sur la pièce, recadré dans l'image actuellement affichée (fonctionne avec n'importe quelle vidéo). */
  const drawCrop = (id: string) => {
    const canvas = cropRef.current;
    const src = engine?.currentSource;
    const s = live.current.samples.get(id);
    if (!canvas || !src || !s || !engine) return;
    // recadrage refait seulement quand la vidéo change d'image
    if (engine.frame === live.current.cropFrame) return;
    live.current.cropFrame = engine.frame;
    // positions et zoom en fraction de l'image de référence (la vidéo mobile peut n'en être qu'un recadrage)
    const fr = src.frame;
    const ch = Math.min(src.height, zoom * fr.height);
    const cw = Math.min(src.width, ch * (canvas.width / canvas.height));
    const sx = clamp(fr.x + s.x * fr.width - cw / 2, 0, src.width - cw);
    const sy = clamp(fr.y + s.y * fr.height - ch / 2, 0, src.height - ch);
    canvas.getContext('2d')?.drawImage(src.source, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
  };

  const update = (t: number) => {
    const layer = layerRef.current;
    if (!engine || !layer) return;
    const L = live.current;
    if (!L.W) {
      L.W = layer.clientWidth;
      L.H = layer.clientHeight;
    }
    const { W, H } = L;
    let best: string | null = null;
    let bestDist = Infinity;
    let openVisible = false;

    // 1) points en vue (position réelle dans la vidéo) ; 2) rangés en bas au centre, au-dessus des commandes
    const shown: { h: Hotspot; el: HTMLButtonElement; s: TrackSample; p: { x: number; y: number } }[] = [];
    for (const h of hotspots) {
      const el = buttons.current.get(h.id);
      if (!el) continue;
      const s = engine.ready ? sampleTrack(h, runs.get(h.id) ?? [], t, gap) : null;
      let visible = false;
      if (s) {
        const p = engine.toScreen(s.x, s.y);
        visible = p.x > 14 && p.x < W - 14 && p.y > 14 && p.y < H - 14 && s.alpha > 0.35;
        if (visible) shown.push({ h, el, s, p });
      }
      if (el.hasAttribute('data-visible') !== visible) {
        el.toggleAttribute('data-visible', visible);
        el.tabIndex = visible ? 0 : -1;
        el.setAttribute('aria-hidden', String(!visible));
      }
    }
    const step = Math.min(DOCK_STEP, W / (shown.length + 1));
    const dockY = H * (1 - DOCK_BOTTOM);
    shown.forEach(({ h, el, s, p }, k) => {
      const dock = { x: W / 2 + (k - (shown.length - 1) / 2) * step, y: dockY };
      const transform = `translate3d(${dock.x.toFixed(1)}px, ${dock.y.toFixed(1)}px, 0)`;
      const key = transform;
      if (L.styles.get(h.id) !== key) {
        L.styles.set(h.id, key);
        el.style.transform = transform;
        el.style.opacity = '1'; // le pop (CSS) remplace le fondu
      }
      L.samples.set(h.id, s);
      L.screen.set(h.id, dock);
      // la pièce « en vedette » reste la plus proche du centre de l'image (position réelle)
      const d = Math.hypot(p.x / W - 0.5, p.y / H - 0.5);
      if (s.alpha > 0.6 && d < bestDist) {
        bestDist = d;
        best = h.id;
      }
      if (h.id === L.openId) openVisible = true;
    });
    if (best !== L.featured) {
      L.featured = best;
      setFeatured(best);
    }

    if (L.openId) {
      if (openVisible) {
        L.shown = true;
        positionPopup(L.openId);
        drawCrop(L.openId);
      } else if (L.shown) {
        L.shown = false;
        L.onOpenChange(null); // la pièce a quitté l'écran : on referme
      }
    }
  };

  useSequenceProgress(({ progress }) => update(progress));

  // tailles en cache, remises à jour quand le calque change de taille (rotation, fenêtre, barre d'adresse)
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !('ResizeObserver' in window)) return;
    const ro = new ResizeObserver(() => {
      const L = live.current;
      L.W = layer.clientWidth;
      L.H = layer.clientHeight;
      L.popW = 0;
      L.styles.clear();
      if (engine) update(engine.current);
    });
    ro.observe(layer);
    return () => ro.disconnect();
  }, [engine]);

  // ouverture / fermeture du popup
  useLayoutEffect(() => {
    live.current.openId = openId;
    live.current.shown = false;
    live.current.popW = 0;
    live.current.cropFrame = -1;
    if (openId && engine) update(engine.current);
  }, [openId, engine]); // positionne le popup avant l'affichage, sans attendre le prochain scroll

  useEffect(() => {
    if (!openId) return;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        buttons.current.get(openId)?.focus({ preventScroll: true });
        onOpenChange(null);
      }
    };
    window.addEventListener('keydown', onKey);
    // clic en dehors de la fiche : on la referme (un clic sur un autre point ouvre directement sa fiche).
    // « click » et non « pointerdown » : un glissé du doigt pour faire défiler ne ferme rien.
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest || target.closest('.vl-popup, .vl-hs')) return;
      onOpenChange(null);
    };
    // écouté après le clic qui a ouvert la fiche, sinon ce même clic la refermerait aussitôt
    const timer = window.setTimeout(() => window.addEventListener('click', onClick));
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
      window.removeEventListener('click', onClick);
    };
  }, [openId, onOpenChange]);

  return (
    <div ref={layerRef} className="vl-hotspots">
      {hotspots.map((h, i) => (
        <button
          key={h.id}
          ref={(el) => {
            if (el) buttons.current.set(h.id, el);
            else buttons.current.delete(h.id);
          }}
          type="button"
          className={cx('vl-hs', featured === h.id && 'is-featured', openId === h.id && 'is-open')}
          aria-label={`${h.label} : ${ui.details}`}
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => onOpenChange(openId === h.id ? null : h.id)}
        >
          <span className="vl-hs-dot" aria-hidden="true">
            {i + 1}
          </span>
          <span className="vl-hs-label">{h.label}</span>
        </button>
      ))}

      {shown && (
        <div
          ref={popupRef}
          key={shown.id}
          className="vl-popup"
          data-closing={open ? undefined : ''}
          inert={!open}
          onAnimationEnd={(e) => {
            if (!open && e.target === e.currentTarget) setClosing(null);
          }}
          role="dialog"
          aria-labelledby={`vl-popup-${shown.id}`}
        >
          <button ref={closeRef} type="button" className="vl-popup-close" onClick={() => onOpenChange(null)} aria-label={ui.close}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <figure className="vl-popup-photo">
            <div className="vl-popup-media">
              {shown.image ? (
                <img src={asset(shown.image)} alt={shown.title} />
              ) : (
                <>
                  <canvas ref={cropRef} width={640} height={400} aria-hidden="true" />
                  <span className="vl-popup-live">
                    <i /> {ui.live}
                  </span>
                </>
              )}
            </div>
            {shown.note && <figcaption className="vl-popup-note">{shown.note}</figcaption>}
          </figure>
          <div className="vl-popup-body">
            {shown.category && (
              <p className="vl-popup-cat">
                <span className="vl-popup-num">{hotspots.indexOf(shown) + 1}</span>
                {shown.category}
              </p>
            )}
            <h3 id={`vl-popup-${shown.id}`}>{shown.title}</h3>
            {shown.description && <p className="vl-popup-desc">{shown.description}</p>}
            {shown.details && shown.details.length > 0 && (
              <dl className="vl-popup-details">
                {shown.details.map((d) => (
                  <div key={d.label}>
                    <dt>{d.label}</dt>
                    <dd>{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {shown.features && shown.features.length > 0 && (
              <ul className="vl-checklist vl-popup-features">
                {shown.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            {shown.link && (
              <div className="vl-popup-foot">
                <a className="vl-btn vl-btn-sm" href={shown.link.href} onClick={() => onOpenChange(null)}>
                  {shown.link.label}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
