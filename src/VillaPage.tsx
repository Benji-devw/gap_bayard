import { Fragment, lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import {
  ScrollSequence,
  SequenceLoader,
  Step,
  cx,
  type ScrollFramesEngine,
  type StepAnim,
  type VideoInput,
} from './lib/scroll-frames';
import { asset } from './lib/asset';
import rawData from './data/villa.json';
import {
  firstSource,
  resolveUi,
  validateVilla,
  type Chapter,
  type Hotspot,
  type MediaSource,
  type Rates,
  type Stories,
  type Universe,
  type UniverseSection,
  type VillaData,
} from './types';
import { bestMoment, toJson } from './utils';
import { Hotspots } from './components/Hotspots';
import { RouteMap } from './components/RouteMap';
import { DroneHud } from './components/DroneHud';
import { FullscreenButton } from './components/FullscreenButton';
import { SoundButton } from './components/SoundButton';
import { PlayButton } from './components/PlayButton';
import { MusicPlayButton } from './components/MusicPlayButton';
import { TravelVeil } from './components/TravelVeil';
import { Icon } from './components/Icon';
import { BookingForm } from './components/BookingForm';
import { Availability } from './components/Availability';
import { StudioInfo } from './components/StudioInfo';
import { RotateHint } from './components/RotateHint';
import { ScrollTutorial } from './components/ScrollTutorial';
import { MapButton } from './components/MapButton';
import { Reviews } from './components/Reviews';
import { Scorecard } from './components/Scorecard';
import { StatCount } from './components/StatCount';
import { UniverseTabs } from './components/UniverseTabs';
import { HeaderNav } from './components/HeaderNav';
import { MENU_QUERY, TOUCH_QUERY } from './lib/media';
import { useSmoothAnchors, type AnchorIntercept } from './lib/smooth-anchors';
import { useReveal } from './lib/reveal';
import { useTravel } from './lib/travel';
import { useFullscreen } from './lib/fullscreen';
import studio from './data/studio.json';
import './villa.css';

/* ------------------------------------------------------------------ données
 * Tout le contenu vient de data/villa.json (voir PROMPT.md pour le modifier en un prompt).
 */
const INITIAL = rawData as unknown as VillaData;
const DRAFT_KEY = 'villa:draft';

/* Éditeur visuel (?edit) : actif en développement, ou en production avec VITE_EDITOR=true.
 * Chargé à la demande : les visiteurs du site ne le téléchargent jamais. */
const EDITOR_ENABLED = import.meta.env.DEV || import.meta.env.VITE_EDITOR === 'true';
const EDITING =
  EDITOR_ENABLED && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('edit');
const HotspotEditor = lazy(() => import('./components/HotspotEditor').then((m) => ({ default: m.HotspotEditor })));

if (import.meta.env.DEV) {
  const issues = validateVilla(INITIAL);
  if (issues.length) console.warn(`[villa.json] ${issues.length} problème(s) :\n- ${issues.join('\n- ')}`);
}

function loadDraft(): VillaData | null {
  if (!EDITING) return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as VillaData;
    // fichiers vidéo : toujours ceux du JSON (un vieux brouillon, ou celui d'un autre projet sur le même localhost, pointerait ailleurs)
    const { src, srcLocal, srcMobile } = INITIAL.media;
    return { ...draft, media: { ...draft.media, src, srcLocal, srcMobile } };
  } catch {
    return null;
  }
}

/** Chemins du JSON (relatifs à public/) → adresses servies, pour un fichier ou une liste de candidats vidéo */
function resolveMedia(source: MediaSource): VideoInput {
  return typeof source === 'string' ? asset(source) : source.map((s) => ({ ...s, src: asset(s.src) }));
}

/** Blocs des sections après la visite qui apparaissent à leur arrivée à l'écran (lib/reveal.ts, style dans villa.css) */
const REVEAL = [
  '.vl-section-head',
  '.vl-universe-tab',
  '.vl-universe-bar',
  '.vl-reviews-score',
  '.vl-brief-photo',
  '.vl-figures > div',
  '.vl-price-tag',
  '.vl-card',
  '.vl-plans',
  '.vl-holes > li',
  '.vl-story-photo',
  '.vl-story-body',
  '.vl-amenities > li',
  '.vl-gallery > figure',
  '.vl-rates-wrap',
  '.vl-rates-extras > div',
  '.vl-rates-foot',
  '.vl-rules > div',
  '.vl-reviews > li',
  '.vl-booking',
  '.vl-contact-links',
  '.vl-host',
  '.vl-contact-card',
] as const;

const ANIM: Record<Chapter['position'], StepAnim> = {
  hero: 'fade-up',
  left: 'fade-right',
  right: 'fade-left',
  center: 'blur',
  'bottom-left': 'fade-up',
  'bottom-right': 'fade-up',
};

/* ------------------------------------------------------------------ sous-composants */
/** Étiquette en cases de carte de score : « Par 72 · 6 103 m » donne une case par segment */
function Kicker({ text }: { text: string }) {
  return (
    <p className="vl-kicker">
      {text.split(' · ').map((part, i) => (
        <span key={i}>{part}</span>
      ))}
    </p>
  );
}

/**
 * Plage de comptage des chiffres d'un chapitre : de 0 dès que le chapitre est entièrement affiché (fin du fondu
 * d'entrée, même durée que le moteur : min(0,06, durée / 3)) jusqu'aux trois quarts du temps où il reste affiché.
 */
function countRange(c: Chapter): [number, number] {
  const fade = Math.min(0.06, (c.out - c.in) / 3);
  const start = c.in + fade;
  return [start, start + (c.out - fade - start) * 0.75];
}

function ChapterStep({ chapter: c }: { chapter: Chapter }) {
  const Title = c.position === 'hero' ? 'h1' : 'h2';
  return (
    <Step in={c.in} out={c.out} anim={ANIM[c.position]} className={`vl-chapter vl-pos-${c.position}`}>
      {c.kicker && <Kicker text={c.kicker} />}
      <Title>{c.title}</Title>
      {c.note && <p className="vl-chapter-note">{c.note}</p>}
      {c.text && <p className="vl-chapter-text">{c.text}</p>}
      {c.stats && (
        <dl className="vl-chapter-stats">
          {c.stats.map((s) => (
            <div key={s.label}>
              <dt>
                <StatCount value={s.value} decimals={s.decimals} range={countRange(c)} resetBelow={c.in} />
                {s.suffix}
              </dt>
              <dd>{s.label}</dd>
            </div>
          ))}
        </dl>
      )}
      {c.meta && <p className="vl-chapter-meta">{c.meta}</p>}
      {c.cta && (
        <a href={c.cta.href} className="vl-btn">
          {c.cta.label}
        </a>
      )}
    </Step>
  );
}

/** En-tête de section : étiquette en cases, titre, note au crayon */
function SectionHead({ kicker, title, note, text }: { kicker?: string; title: string; note?: string; text?: string }) {
  return (
    <div className="vl-section-head">
      {kicker && <Kicker text={kicker} />}
      <h2>{title}</h2>
      {note && <p className="vl-hand vl-section-note">{note}</p>}
      {text && <p className="vl-lead">{text}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ univers (sections.universes) */
type Universes = NonNullable<VillaData['sections']['universes']>;

/** Ancres des sections du JSON qu'un univers peut reprendre */
const SECTION_IDS: Record<UniverseSection, string> = { stats: 'le-parcours', holes: 'les-trous', rooms: 'le-club' };

/** Ancres que contient un univers : lui-même, ses sections reprises, ses récits (et chacun d'eux), ses tarifs */
function universeAnchors(u: Universe): string[] {
  return [
    u.id,
    ...(u.sections ?? []).map((s) => SECTION_IDS[s]),
    u.stories?.id,
    ...(u.stories?.items.map((it) => it.id) ?? []),
    u.rates && (u.rates.id ?? 'tarifs'),
  ].filter((a): a is string => !!a);
}

/** Univers qui contient l'ancre de l'adresse (#golf, #tarifs…), sinon null */
function universeOfHash(universes: Universes, hash: string): string | null {
  let id = '';
  try {
    id = decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return null;
  }
  return (id && universes.items.find((u) => universeAnchors(u).includes(id))?.id) || null;
}

/** Univers de la saison en cours (season, dates « MM-JJ », la plage peut passer le 31 décembre), sinon le premier */
function universeOfSeason(universes: Universes, date = new Date()): string {
  const s = universes.season;
  if (s && universes.items.some((u) => u.id === s.universe)) {
    const md = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (s.from <= s.to ? md >= s.from && md <= s.to : md >= s.from || md <= s.to) return s.universe;
  }
  return universes.items[0]?.id ?? '';
}

/** Lien vers une autre adresse (réservation, billetterie) : nouvel onglet */
const external = (href: string) => (href.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {});

/* ------------------------------------------------------------------ page */
export default function VillaPage() {
  const [restored] = useState(() => loadDraft() !== null);
  const [data, setData] = useState<VillaData>(() => loadDraft() ?? INITIAL);
  const [openId, setOpenId] = useState<string | null>(null);
  const [stay, setStay] = useState<{ arrival: string; departure: string } | null>(null);
  const [solidHeader, setSolidHeader] = useState(false);
  // plein écran pendant la visite (natif, ou immersif sur iPhone) : en-tête rangé, une fleur en haut au centre pour le rappeler
  const { active: fullscreen } = useFullscreen();
  const [headerPeek, setHeaderPeek] = useState(false);
  useEffect(() => {
    if (!fullscreen) setHeaderPeek(false);
  }, [fullscreen]);
  const [menuOpen, setMenuOpen] = useState(false);
  const engineRef = useRef<ScrollFramesEngine | null>(null);
  const { travel, toMoment, interceptAnchor } = useTravel(engineRef, () => setOpenId(null));
  const { meta, theme, brand, media, hud, chapters, hotspots, sections, footer } = data;
  // univers en onglets sous la visite : celui de l'adresse (#golf, #tarifs…), sinon celui de la saison
  const universes = sections.universes;
  const [universe, setUniverse] = useState(() =>
    universes ? (universeOfHash(universes, window.location.hash) ?? universeOfSeason(universes)) : '',
  );
  const centreRef = useRef<HTMLElement>(null);
  const gap = data.hotspotSettings?.gap ?? 0.04;
  const zoom = data.hotspotSettings?.zoom ?? 0.34;

  useEffect(() => {
    document.documentElement.lang = meta.lang ?? 'fr';
  }, [meta.lang]);

  // brouillon de l'éditeur, conservé dans ce navigateur
  useEffect(() => {
    if (!EDITING) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {
      /* stockage indisponible : l'édition reste possible, sans brouillon */
    }
  }, [data]);

  /**
   * Lien vers un univers ou vers son contenu (#nordique, #tarifs…) : l'univers s'affiche d'abord (rendu immédiat,
   * pour mesurer la destination), puis le trajet habituel. Vers l'univers lui-même, on s'arrête sur ses cartes.
   */
  const onAnchor: AnchorIntercept = (target, link) => {
    const panel = target.closest<HTMLElement>('[data-universe]');
    if (!panel) return interceptAnchor(target, link);
    flushSync(() => setUniverse(panel.dataset.universe!));
    const dest = target === panel ? (centreRef.current ?? panel) : target;
    if (!interceptAnchor(dest, link)) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      dest.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
    return true;
  };

  // liens internes (#section) : défilement lisse, ou transition quand le trajet traverse la visite
  useSmoothAnchors(onAnchor);

  // retour arrière du navigateur vers un autre univers
  useEffect(() => {
    if (!universes) return;
    const onPop = () => {
      const id = universeOfHash(universes, window.location.hash);
      if (id) setUniverse(id);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [universes]);

  /**
   * Carte d'univers choisie : son contenu s'affiche dessous, l'adresse suit (#golf) sans ajouter d'étape à l'historique.
   * D'un clic (`scroll`), on descend à la première section de l'univers (rendu immédiat pour la trouver à sa place).
   */
  const selectUniverse = (id: string, scroll: boolean) => {
    flushSync(() => setUniverse(id));
    history.replaceState(null, '', `#${id}`);
    if (!scroll) return;
    const first = document.getElementById(id)?.querySelector<HTMLElement>('.vl-section');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    first?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  // sections après la visite : chaque bloc apparaît une fois, à son arrivée à l'écran
  useReveal(REVEAL);

  // en-tête opaque une fois la visite terminée
  useEffect(() => {
    const onScroll = () => {
      const section = engineRef.current?.section;
      if (section) setSolidHeader(section.getBoundingClientRect().bottom < 90);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // menu mobile : Échap ferme, et il se referme si l'écran repasse en large
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    const menu = window.matchMedia(MENU_QUERY);
    const onWide = () => !menu.matches && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    menu.addEventListener('change', onWide);
    return () => {
      window.removeEventListener('keydown', onKey);
      menu.removeEventListener('change', onWide);
    };
  }, [menuOpen]);

  /** Amène la visite sur un lieu et ouvre sa fiche (transition si le lieu est loin : voir lib/travel.ts) */
  const showInTour = (h: Hotspot) => {
    const t = bestMoment(h, gap);
    if (t === null) return;
    toMoment(t, { label: h.label, kicker: ui.travel, num: hotspots.indexOf(h) + 1 }, () => setOpenId(h.id));
  };

  const resetDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* rien à nettoyer */
    }
    setData(INITIAL);
  };

  const c = theme.colors;
  const themeStyle = {
    '--bg': c.bg,
    '--surface': c.surface,
    '--fg': c.fg,
    '--muted': c.muted,
    '--line': c.line,
    '--accent': c.accent,
    '--accent2': c.accent2,
    '--highlight': c.highlight ?? c.accent2,
    '--ink': c.ink,
    '--display': theme.fonts.display,
    '--body': theme.fonts.body,
    '--hand': theme.fonts.hand,
  } as CSSProperties;

  // vidéo trop lourde pour Git : en ligne sur R2 (src), copie locale en dev et en « npm run preview » (srcLocal)
  const local = import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const mainSrc = resolveMedia(local && media.srcLocal ? media.srcLocal : media.src);
  const mobileSrc = media.srcMobile ? resolveMedia(media.srcMobile) : undefined;
  const mediaProps =
    media.type === 'video'
      ? { video: mainSrc, videoMobile: mobileSrc, count: media.count, countMobile: media.countMobile }
      : { src: firstSource(mainSrc), srcMobile: mobileSrc && firstSource(mobileSrc), count: media.count };
  const hero = chapters.find((c) => c.position === 'hero');
  const ui = resolveUi(data.ui);
  // musique : volume ordinateur, ou volume propre à l'écran tactile (téléphone, tablette) s'il est donné
  const audioVolume =
    data.audio && window.matchMedia(TOUCH_QUERY).matches ? (data.audio.volumeMobile ?? data.audio.volume) : data.audio?.volume;
  const host = sections.contact.host;
  const tourFullscreen = fullscreen && !solidHeader && !menuOpen;
  const headerTucked = tourFullscreen && !headerPeek;
  // menu : une entrée qui mène à un univers reprend sa petite ligne, sa phrase et sa photo si elles manquent
  const navItems = brand.nav.map((n) => {
    const u = universes?.items.find((x) => `#${x.id}` === n.href);
    return u ? { ...n, kicker: n.kicker ?? u.kicker, text: n.text ?? u.text, image: n.image ?? u.image } : n;
  });

  /* ---------------------------------------------------------------- sections du parcours
   * À leur place après la visite, ou dans l'univers qui les reprend (sections.universes.items[].sections). */
  const statsSection = (
    <section id={SECTION_IDS.stats} className="vl-section vl-brief">
      {sections.stats.image && (
        <figure className="vl-brief-photo">
          <img src={asset(sections.stats.image)} alt={sections.stats.imageCaption ?? ''} loading="lazy" />
          {sections.stats.imageCaption && <figcaption>{sections.stats.imageCaption}</figcaption>}
        </figure>
      )}
      <div className="vl-brief-body">
        <SectionHead
          kicker={sections.stats.kicker}
          title={sections.stats.title}
          note={sections.stats.note}
          text={sections.stats.text}
        />
        <div className="vl-brief-side">
          <dl className="vl-figures">
            {sections.stats.items.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          {brand.price && (
            <p className="vl-price-tag">
              <span className="vl-hand">à partir de</span>
              <strong>{brand.price}</strong>
              {brand.priceNote && <span>{brand.priceNote}</span>}
            </p>
          )}
        </div>
      </div>
    </section>
  );

  const holesSection = sections.holes && (
    <section id={SECTION_IDS.holes} className="vl-section vl-holes-section">
      <SectionHead kicker={sections.holes.kicker} title={sections.holes.title} note={sections.holes.note} text={sections.holes.text} />
      <Scorecard holes={sections.holes} ui={ui} />
    </section>
  );

  const roomsSection = hotspots.length > 0 && (
    <section id={SECTION_IDS.rooms} className="vl-section vl-rooms-section">
      <SectionHead kicker={sections.rooms.kicker} title={sections.rooms.title} text={sections.rooms.text} />
      <ol className="vl-holes">
        {hotspots.map((h, i) => (
          <li key={h.id}>
            <button type="button" className="vl-hole" onClick={() => showInTour(h)}>
              <span className="vl-hole-photo">
                {h.image ? <img src={asset(h.image)} alt="" loading="lazy" /> : <span className="vl-thumb-empty" />}
              </span>
              <span className="vl-hole-head">
                <span className="vl-hole-num">{String(i + 1).padStart(2, '0')}</span>
                {h.category && <span className="vl-hole-cat">{h.category}</span>}
              </span>
              <span className="vl-hole-name">{h.label}</span>
              {h.note && <span className="vl-hand vl-hole-note">{h.note}</span>}
              <span className="vl-hole-link">{ui.seeInTour}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );

  const reused: Record<UniverseSection, ReactNode> = { stats: statsSection, holes: holesSection, rooms: roomsSection };

  /** Récits en photo + texte, en alternance */
  const storiesSection = (st: Stories, id: string) => (
    <section id={st.id ?? id} className="vl-section vl-stories-section">
      <SectionHead kicker={st.kicker} title={st.title} text={st.text} />
      <div className="vl-stories">
        {st.items.map((it) => (
          <article key={it.title} className="vl-story">
            {/* ancre du récit (sous-catégorie du menu) : décalée de la hauteur de l'en-tête, pour tous les trajets */}
            {it.id && <span id={it.id} className="vl-anchor" aria-hidden="true" />}
            <figure className="vl-story-photo">
              <img src={asset(it.image)} alt={it.imageAlt ?? ''} loading="lazy" />
            </figure>
            <div className="vl-story-body">
              {it.kicker && <Kicker text={it.kicker} />}
              <h3>{it.title}</h3>
              <p>{it.text}</p>
              {it.facts && it.facts.length > 0 && (
                <dl className="vl-story-facts">
                  {it.facts.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {it.link && (
                <a className="vl-link" href={it.link.href} {...external(it.link.href)}>
                  {it.link.label}
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  /** Tarifs : tableau façon carte de score, tarifs annexes par groupe */
  const ratesSection = (r: Rates) => (
    <section id={r.id ?? 'tarifs'} className="vl-section vl-rates-section">
      <SectionHead kicker={r.kicker} title={r.title} note={r.note} text={r.text} />
      <div className="vl-rates-wrap">
        <table className="vl-rates">
          <thead>
            <tr>
              <th scope="col">{r.itemLabel ?? ui.ratesItem}</th>
              {r.columns.map((col) => (
                <th key={col.label} scope="col">
                  {col.label}
                  {col.period && <span>{col.period}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.values.map((v, k) => (
                  <td key={k}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.extras && r.extras.length > 0 && (
        <div className="vl-rates-extras">
          {r.extras.map((group) => (
            <div key={group.title}>
              <h3>{group.title}</h3>
              <dl>
                {group.items.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
      {(r.source || r.link) && (
        <p className="vl-rates-foot">
          {r.source}
          {r.link && (
            <a href={r.link.href} target="_blank" rel="noopener">
              {r.link.label}
            </a>
          )}
        </p>
      )}
    </section>
  );

  return (
    <div className="tpl-villa" style={themeStyle}>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      {theme.fonts.url && <link rel="stylesheet" href={theme.fonts.url} precedence="default" />}

      <header
        className={cx('vl-header', (solidHeader || menuOpen) && 'is-solid', menuOpen && 'is-menu-open', headerTucked && 'is-tucked')}
        inert={headerTucked}
        onClick={(e) => {
          // un lien choisi dans l'en-tête rappelé en plein écran : on le range de nouveau
          if ((e.target as Element).closest('a')) setHeaderPeek(false);
        }}
      >
        <a href="#top" className="vl-logo" data-travel={brand.name} onClick={() => setMenuOpen(false)}>
          {brand.logo ? (
            <img className="vl-logo-img" src={asset(brand.logo)} alt={brand.name} />
          ) : (
            <>
              <span className="vl-logo-mark" aria-hidden="true" />
              {brand.name}
            </>
          )}
          <span className="vl-logo-place">{brand.location}</span>
        </a>
        <HeaderNav items={navItems} disabled={headerTucked || menuOpen} labels={{ sub: ui.navSub, all: ui.navAll }} />
        {data.map && <MapButton query={data.map.query} label={ui.map} />}
        <StudioInfo note={data.studioNote} />
        <a href={brand.cta.href} className="vl-btn vl-btn-sm vl-btn-header">
          {brand.cta.label}
        </a>
        <button
          type="button"
          className="vl-burger"
          aria-expanded={menuOpen}
          aria-controls="vl-menu"
          aria-label={menuOpen ? ui.close : ui.menu}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span aria-hidden="true" />
        </button>
      </header>
      {tourFullscreen && (
        <button
          type="button"
          className={cx('vl-header-peek', headerPeek && 'is-open')}
          aria-expanded={headerPeek}
          aria-label={headerPeek ? ui.hideHeader : ui.showHeader}
          title={headerPeek ? ui.hideHeader : ui.showHeader}
          onClick={() => setHeaderPeek((v) => !v)}
        >
          <span className="vl-logo-mark" aria-hidden="true" />
        </button>
      )}

      <TravelVeil travel={travel} />

      {/* menu mobile (≤ 900 px) */}
      <nav id="vl-menu" className={cx('vl-menu', menuOpen && 'is-open')} inert={!menuOpen}>
        <ul>
          {navItems.map((l, i) => (
            <li key={l.href} style={{ '--i': i } as CSSProperties}>
              <a href={l.href} onClick={() => setMenuOpen(false)}>
                {l.label}
              </a>
              {l.children && l.children.length > 0 && (
                <ul className="vl-menu-sub">
                  {l.children.map((c) => (
                    <li key={c.href}>
                      <a href={c.href} onClick={() => setMenuOpen(false)}>
                        {c.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <a href={brand.cta.href} className="vl-btn" onClick={() => setMenuOpen(false)}>
          {brand.cta.label}
        </a>
      </nav>

      <ScrollSequence
        id="top"
        {...mediaProps}
        length={media.length ?? 1100}
        fit={media.fit ?? 'cover'}
        focus={media.focus}
        smooth={media.smooth ?? 0.08}
        smoothTouch={media.smoothTouch}
        slowdowns={media.slowdowns}
        pace={media.pace}
        engineRef={engineRef}
        layerClassName="vl-layer"
        loader={
          <SequenceLoader
            className="vl-loader"
            label={
              <span className="vl-loader-brand">
                {brand.logo ? (
                  <img className="vl-logo-img" src={asset(brand.logo)} alt={brand.name} />
                ) : (
                  <>
                    <span className="vl-logo-mark" aria-hidden="true" />
                    {brand.name}
                  </>
                )}
                <span className="vl-hand">{ui.loading}</span>
              </span>
            }
          />
        }
        overlay={
          <>
            {/* viseur drone du début : signature Navart */}
            {hud?.enabled && <DroneHud telemetry={hud.telemetry ?? []} until={hud.until ?? 0.2} fps={hud.fps} format={ui.hudFormat} />}
            <RouteMap hotspots={hotspots} title={ui.route} onSelect={showInTour} />
            <Hotspots hotspots={hotspots} gap={gap} zoom={zoom} ui={ui} openId={openId} onOpenChange={setOpenId} />
            {EDITING && (
              <Suspense fallback={null}>
                <HotspotEditor
                  hotspots={hotspots}
                  mediaSrc={media.type === 'video' ? firstSource(mainSrc) : null}
                  onPace={(pace) => setData((d) => ({ ...d, media: { ...d.media, pace } }))}
                  onChange={(next) => setData((d) => ({ ...d, hotspots: next }))}
                  getJson={() => toJson(data) + '\n'}
                  onReset={resetDraft}
                  restored={restored}
                />
              </Suspense>
            )}
            <div className="vl-tour-controls">
              {data.audio && (
                <SoundButton src={asset(data.audio.src)} volume={audioVolume} label={ui.soundOn} offLabel={ui.soundOff} />
              )}
              {data.play && (
                <PlayButton
                  duration={data.play.duration ?? (media.count ?? 1500) / (hud?.fps ?? 25)}
                  follow={data.play.follow}
                  pace={media.pace}
                  slowdowns={media.slowdowns}
                  hold={openId !== null}
                  onStart={() => setOpenId(null)}
                  label={ui.play}
                  pauseLabel={ui.pause}
                />
              )}
              {data.play?.withMusic && data.audio && (
                <MusicPlayButton
                  src={asset(data.audio.src)}
                  volume={audioVolume}
                  from={Math.max(0, data.play.musicOffset ?? 0) / ((media.count ?? 1500) / (hud?.fps ?? 25))}
                  musicStart={Math.max(0, -(data.play.musicOffset ?? 0))}
                  onStart={() => setOpenId(null)}
                  text={ui.playWithMusicText}
                  label={ui.playWithMusic}
                  pauseLabel={ui.pauseWithMusic}
                />
              )}
              <FullscreenButton label={ui.fullscreen} exitLabel={ui.exitFullscreen} hint={ui.fullscreenHint} />
            </div>
            <div className="vl-progress" aria-hidden="true">
              <div className="sf-progress-x" />
            </div>
          </>
        }
      >
        {chapters.map((chapter, i) => (
          <ChapterStep key={i} chapter={chapter} />
        ))}
        {hero && (
          <Step in={0} out={hero.in > 0 ? hero.in : hero.out} anim="fade" className="vl-tuto" aria-hidden="true">
            <ScrollTutorial labels={{ touch: ui.tutorialTouch, trackpad: ui.tutorialTrackpad, wheel: ui.tutorialWheel }} />
          </Step>
        )}
        {hero && <RotateHint until={hero.in > 0 ? hero.in : hero.out} label={ui.rotateHint} close={ui.close} />}
      </ScrollSequence>

      {universes ? (
        <>
          {/* ------------------------------------------------------------ univers : grandes cartes, puis le contenu de celle choisie */}
          <section ref={centreRef} id={universes.id ?? 'le-centre'} className="vl-section vl-universes-section">
            <SectionHead kicker={universes.kicker} title={universes.title} text={universes.text} />
            <UniverseTabs
              items={universes.items}
              active={universe}
              now={universes.season ? universeOfSeason(universes) : undefined}
              nowLabel={ui.universeNow}
              label={universes.title}
              onSelect={selectUniverse}
            />
          </section>
          {universes.items.map((u) => (
            <div
              key={u.id}
              id={u.id}
              role="tabpanel"
              aria-labelledby={`tab-${u.id}`}
              className="vl-universe"
              data-universe={u.id}
              hidden={u.id !== universe}
            >
              {(u.text || (u.cta && u.cta.length > 0)) && (
                <div className="vl-universe-bar">
                  {u.text && <p>{u.text}</p>}
                  {u.cta && u.cta.length > 0 && (
                    <div className="vl-universe-actions">
                      {u.cta.map((l, k) => (
                        <a key={l.href} href={l.href} className={k === 0 ? 'vl-btn' : 'vl-btn vl-btn-line'} {...external(l.href)}>
                          {l.label}
                          {l.href.startsWith('http') && (
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M7 17L17 7M9 7h8v8" />
                            </svg>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {u.sections?.map((key) => <Fragment key={key}>{reused[key]}</Fragment>)}
              {u.stories && storiesSection(u.stories, `${u.id}-recits`)}
              {u.rates && ratesSection(u.rates)}
            </div>
          ))}
        </>
      ) : (
        <>
          {/* ------------------------------------------------------------ le parcours en bref, les trous, les lieux, séjourner */}
          {statsSection}
          {holesSection}
          {roomsSection}
          {sections.stories && storiesSection(sections.stories, 'sejourner')}
        </>
      )}

      {/* ------------------------------------------------------------ sur place */}
      <section id="sur-place" className="vl-section vl-amenities-section">
        <SectionHead kicker={sections.amenities.kicker} title={sections.amenities.title} note={sections.amenities.note} />
        <ul className="vl-amenities">
          {sections.amenities.items.map((item) => (
            <li key={item.label}>
              <Icon name={item.icon} />
              <span>
                <strong>{item.label}</strong>
                {item.text && <span>{item.text}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------ galerie */}
      <section id="galerie" className="vl-section vl-gallery-section">
        <SectionHead kicker={sections.gallery.kicker} title={sections.gallery.title} />
        <div className="vl-gallery">
          {sections.gallery.items.map((g) => (
            <figure key={g.src}>
              <img src={asset(g.src)} alt={g.caption} loading="lazy" />
              <figcaption>{g.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ tarifs (sans univers ; avec, chacun a les siens) */}
      {!universes && sections.rates && ratesSection(sections.rates)}

      {/* ------------------------------------------------------------ infos pratiques */}
      <section id="infos" className="vl-section vl-rules-section">
        <SectionHead kicker={sections.rules.kicker} title={sections.rules.title} />
        <dl className="vl-rules">
          {sections.rules.items.map((r) => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ------------------------------------------------------------ avis (JSON ou API Google) */}
      {sections.reviews && (
        <Reviews section={sections.reviews} mapQuery={data.map?.query} lang={meta.lang} ui={ui} className="vl-section vl-reviews-section" />
      )}

      {/* ------------------------------------------------------------ réserver : départ en ligne, ou demande (groupe, cours, séminaire) */}
      <section id="reserver" className="vl-section vl-contact">
        <div className="vl-contact-info">
          <SectionHead kicker={sections.contact.kicker} title={sections.contact.title} text={sections.contact.text} />
          {sections.contact.links && sections.contact.links.length > 0 ? (
            /* accès directs : une ligne par action, flèche au bout (nouvel onglet pour une autre adresse) */
            <ul className="vl-contact-links">
              {sections.contact.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} {...external(l.href)}>
                    <span className="vl-contact-link-name">{l.label}</span>
                    {l.note && <span className="vl-contact-link-note">{l.note}</span>}
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d={l.href.startsWith('http') ? 'M7 17L17 7M9 7h8v8' : 'M5 12h14M13 6l6 6-6 6'} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          ) : sections.contact.booking && (
            <div className="vl-booking">
              <a href={sections.contact.booking.href} className="vl-btn vl-btn-big" target="_blank" rel="noopener">
                {sections.contact.booking.label}
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 17L17 7M9 7h8v8" />
                </svg>
              </a>
              {sections.contact.bookingNote && <p>{sections.contact.bookingNote}</p>}
            </div>
          )}
          <div className="vl-host">
            <span className="vl-host-avatar" aria-hidden="true">
              <Icon name="flag" />
            </span>
            <span>
              <strong>{host.name}</strong>
              <span>{host.role}</span>
              <a href={`tel:${host.phone.replace(/\s/g, '')}`}>{host.phone}</a>
              <a href={`mailto:${host.email}`}>{host.email}</a>
            </span>
          </div>
          {host.note && <p className="vl-hand vl-host-note">{host.note}</p>}
        </div>
        <div className="vl-contact-card">
          {sections.contact.availability && (
            <Availability config={sections.contact.availability} lang={meta.lang} ui={ui} onPick={setStay} />
          )}
          <BookingForm contact={sections.contact} labels={ui.form} dates={stay} universe={universe || undefined} />
        </div>
      </section>

      <footer className="vl-footer">
        <span className="vl-logo">
          {brand.logo ? (
            <img className="vl-logo-img" src={asset(brand.logo)} alt={brand.name} />
          ) : (
            <>
              <span className="vl-logo-mark" aria-hidden="true" />
              {brand.name}
            </>
          )}
        </span>
        <p>{footer.text}</p>
        {footer.credits?.map((credit) => (
          <p key={credit.label + credit.author} className="vl-footer-credit">
            {credit.label}{' '}
            {credit.authorHref ? (
              <a href={credit.authorHref} target="_blank" rel="noopener">
                {credit.author}
              </a>
            ) : (
              credit.author
            )}
            {credit.href && (
              <>
                {' · '}
                <a href={credit.href} target="_blank" rel="noopener">
                  {credit.linkLabel ?? credit.href}
                </a>
              </>
            )}
          </p>
        ))}
        <p className="vl-footer-credit">
          {studio.credit}{' '}
          <a href={studio.site.href} target="_blank" rel="noopener">
            {studio.name}
          </a>
        </p>
        <nav>
          {footer.links.map((l) => (
            <a key={l.label} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}
