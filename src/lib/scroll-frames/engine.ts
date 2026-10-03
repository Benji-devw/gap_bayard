/**
 * ScrollFrames — moteur de lecture de séquences d'images piloté par le scroll.
 * Indépendant de React : les composants de ce dossier ne font que l'envelopper.
 *
 * Rien ne provoque de re-render React pendant le scroll : le moteur dessine dans le canvas
 * et écrit des variables CSS (--sf-progress, --sf-p, --sf-v, --sf-e) directement sur le DOM.
 */

export type Fit = 'cover' | 'contain';

/**
 * Portion de l'image de référence que contient une vidéo recadrée (fractions 0..1 depuis le coin haut-gauche).
 * Ex. vidéo mobile en portrait 3:4 découpée au centre d'une vidéo 16:9 : { x: 0.289, y: 0, width: 0.422, height: 1 }.
 * Toutes les positions (points, éditeur, zoom des fiches) restent exprimées dans l'image de référence.
 */
export interface FrameCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Un candidat vidéo : le premier que l'écran et le navigateur acceptent est lu. */
export interface VideoSource {
  src: string;
  /** Type MIME avec codecs, ex. 'video/mp4; codecs="hvc1.1.6.L120.B0"' : ignoré si le navigateur ne sait pas le lire */
  type?: string;
  /** Requête média que l'écran doit satisfaire, ex. '(orientation: portrait)' (réévaluée au redimensionnement) */
  media?: string;
  /** Recadrage de cette vidéo par rapport à l'image de référence */
  crop?: FrameCrop;
  /** Nombre d'images de cette vidéo si sa cadence diffère de la vidéo de référence (sinon `count` / `countMobile`) */
  count?: number;
}

/** Une vidéo : une adresse, ou une liste de candidats (codecs, orientation, recadrage) */
export type VideoInput = string | VideoSource[];

export interface ScrollFramesOptions {
  /** Motif d'URL, ex. "/frames/produit/{index}.webp" ({index} = numéro complété de zéros, {n} = brut) */
  src?: string;
  /** Alternative à `src` : liste explicite d'URL */
  frames?: string[];
  /**
   * Alternative aux images : une vidéo MP4/WebM pilotée par le scroll.
   * Pour un scrub fluide, encodez-la avec une image clé toutes les 8 à 12 images (voir README).
   * Liste de candidats : le premier lisible par le navigateur (`type`) et adapté à l'écran (`media`) est choisi.
   */
  video?: VideoInput;
  /** Vidéo plus légère sous le breakpoint (même durée que `video` ; même cadrage, ou recadrée avec `crop`) */
  videoMobile?: VideoInput;
  /**
   * Ralentis : dans ces plages de la vidéo (progression 0..1), le scroll avance `factor` fois plus lentement.
   * Idéal pour laisser le temps de lire un popup quand la caméra passe vite. Ex. [{ from: 0.23, to: 0.27, factor: 4 }]
   * Toutes les progressions (étapes, compteurs, événements) restent exprimées en temps de vidéo.
   */
  slowdowns?: { from: number; to: number; factor: number }[];
  /**
   * Rythme : poids de scroll pour N tranches égales de la vidéo (1 = normal, 2 = deux fois plus de scroll).
   * Généré par analyzeMotion() : les passages où l'image bouge beaucoup reçoivent plus de scroll.
   * Se combine avec `slowdowns` (les poids sont multipliés).
   */
  pace?: number[];
  /** Nombre d'images de la séquence */
  count?: number;
  /** Numéro du premier fichier (défaut 1) */
  start?: number;
  /** Nombre de chiffres de {index} (défaut 4 → 0001) */
  pad?: number;
  /** Séquence alternative sous le breakpoint (ex. images verticales pour mobile) */
  srcMobile?: string;
  /**
   * Séquence d'images : nombre d'images de `srcMobile`. Vidéo : nombre d'images de `videoMobile` quand elle
   * a une autre cadence (ex. 30 images/s sur mobile pour une vidéo ordinateur à 60) ; les recherches sont
   * alors arrondies à ses images. Progressions, étapes et `count` restent ceux de la vidéo ordinateur.
   */
  countMobile?: number;
  /** Petit côté de l'écran (px) sous lequel on bascule sur la version mobile, quelle que soit l'orientation (défaut 768) */
  breakpoint?: number;
  /**
   * Remplissage du canvas : cover (plein cadre, recadré) ou contain (image entière).
   * En cover (et fitMobile absent ou cover), le canvas est créé opaque : composition plus légère sur téléphone.
   */
  fit?: Fit;
  fitMobile?: Fit;
  /** Point focal du recadrage "cover", ex. "50% 30%" */
  focus?: string;
  /** Inertie 0..1 — plus c'est bas, plus c'est doux (1 = aucune inertie) */
  smooth?: number;
  /**
   * Inertie sur écran tactile (défaut 0.25) : le défilement au doigt a déjà sa propre inertie, un lissage
   * trop doux y donne une impression de retard. Jamais plus doux que `smooth`.
   */
  smoothTouch?: number;
  /**
   * Densité de pixels maximale du canvas (défaut 3 : iPhone Pro, Pixel). Le canvas n'a de toute façon jamais
   * plus de pixels que la vidéo n'en apporte à l'écran : la netteté réelle vient de la définition de la source.
   */
  dpr?: number;
  /** Téléchargements simultanés (défaut 6) */
  concurrency?: number;
  /** true = précharge dès le montage, sinon à l'approche de la section */
  eager?: boolean;
}

export interface StepConfig {
  in: number;
  out: number;
  fade?: number;
}

export interface CounterConfig {
  from: number;
  to: number;
  range: [number, number];
  decimals?: number;
  locale?: string;
}

export interface EngineEvents {
  progress: { progress: number; frame: number };
  load: { loaded: number; total: number; ready: number };
  ready: { total: number };
  loaded: { failed: number };
  error: { url: string };
  /** Lecture automatique native démarrée ou arrêtée : fin de la vidéo, visiteur qui reprend la main, onglet masqué, arrêt demandé, lecture refusée */
  playback: { playing: boolean; reason?: PlaybackStop };
}

/** Image (ou vidéo) actuellement affichée, avec ses dimensions et la place de l'image de référence dedans. */
export interface CurrentSource {
  source: CanvasImageSource;
  /** Dimensions de la source réellement dessinée (px) */
  width: number;
  height: number;
  /**
   * Image de référence (dont la source est éventuellement un recadrage), en px de la source : c'est elle que
   * décrivent les positions 0..1. Sans recadrage : { x: 0, y: 0, width, height }.
   */
  frame: { x: number; y: number; width: number; height: number };
}

export type PlaybackStop = 'end' | 'user' | 'hidden' | 'stop' | 'error';

type Handler<K extends keyof EngineEvents> = (detail: EngineEvents[K]) => void;

interface StepEntry {
  node: HTMLElement;
  a: number;
  b: number;
  fade: number;
  v: number;
  p: number;
}

interface CounterEntry {
  node: HTMLElement;
  cfg: CounterConfig;
  format: Intl.NumberFormat;
  last: string;
}

const DEFAULTS = {
  src: '',
  start: 1,
  pad: 4,
  count: 0,
  breakpoint: 768,
  fit: 'cover' as Fit,
  focus: '50% 50%',
  smooth: 0.12,
  smoothTouch: 0.25,
  dpr: 3,
  concurrency: 6,
  eager: false,
};

const FULL_FRAME: FrameCrop = { x: 0, y: 0, width: 1, height: 1 };

const clamp = (v: number, min = 0, max = 1) => (v < min ? min : v > max ? max : v);
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Part de la barre de chargement consacrée au téléchargement de la vidéo ; le reste couvre sa préparation. */
const VIDEO_DOWNLOAD_SHARE = 0.9;
/** Délai maximal pour obtenir la première image d'une vidéo en mémoire (blob) : au-delà, lecture en streaming */
const OPEN_LOCAL_TIMEOUT = 8000;
/** Délai maximal pour la première image en streaming (réseau lent) */
const OPEN_STREAM_TIMEOUT = 30000;
/** Lecture automatique : écart (px) entre la position voulue et la position réelle au-delà duquel le visiteur a repris la main */
const PLAYBACK_TOLERANCE = 3;
/** Vitesses de lecture acceptées par tous les navigateurs (Safari iOS plafonne au-delà de 2) */
const PLAYBACK_RATE_MIN = 0.5;
const PLAYBACK_RATE_MAX = 2;

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/**
 * Le canvas sait-il copier l'image de la vidéo ? Firefox Android le laisse vide (page blanche à la place
 * de la visite) : on y dessine la vidéo en tout petit et on regarde si un pixel a été posé.
 */
function canvasDrawsVideo(v: HTMLVideoElement) {
  if (/Android/i.test(navigator.userAgent) && /Firefox\//.test(navigator.userAgent)) return false;
  try {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 4;
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    if (!ctx) return true;
    ctx.drawImage(v, 0, 0, 4, 4);
    const px = ctx.getImageData(0, 0, 4, 4).data;
    for (let i = 3; i < px.length; i += 4) if (px[i]) return true;
    return false;
  } catch {
    return true; // vidéo d'un autre domaine (lecture interdite) : on ne peut pas vérifier
  }
}

/** Déplace la vidéo et attend que l'image soit prête (délai maximal : la préparation ne bloque jamais). */
function seekAndWait(v: HTMLVideoElement, time: number, timeout = 1500) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      v.removeEventListener('seeked', done);
      resolve();
    };
    const timer = setTimeout(done, timeout);
    v.addEventListener('seeked', done);
    v.currentTime = time;
  });
}

/** Détache une vidéo (libère le décodeur et la mémoire, sans attendre le ramasse-miettes). */
function discardVideo(v: HTMLVideoElement) {
  v.removeAttribute('src');
  v.load();
}

/**
 * Crée l'élément vidéo (muet et « en ligne » : indispensable pour qu'iOS accepte de la lire sans geste)
 * et attend sa première image. iOS ne décode rien tant qu'on ne le lui demande pas : dès les métadonnées,
 * une recherche minuscule force la première image. Résolu à null si la vidéo est illisible, ou muette
 * au bout de `timeout` ms (ex. adresse blob refusée) : l'appelant essaie alors une autre façon de la lire.
 */
function openVideo(src: string, timeout: number) {
  return new Promise<HTMLVideoElement | null>((resolve) => {
    const v = document.createElement('video');
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    v.src = src;
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      v.removeEventListener('loadeddata', onFrame);
      v.removeEventListener('seeked', onFrame);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('error', onError);
      if (!ok) discardVideo(v);
      resolve(ok ? v : null);
    };
    const onFrame = () => {
      if (v.readyState >= 2) finish(true);
    };
    const onMeta = () => {
      if (v.readyState < 2) v.currentTime = 0.001;
    };
    const onError = () => finish(false);
    const timer = setTimeout(() => finish(false), timeout);
    v.addEventListener('loadeddata', onFrame);
    v.addEventListener('seeked', onFrame);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('error', onError);
    v.load();
  });
}

let probeVideo: HTMLVideoElement | null = null;

/**
 * Choisit la vidéo à lire dans une liste de candidats : le premier dont la requête média (`media`) est
 * satisfaite et dont le type (`type`) est lisible par le navigateur. Aucun ne convient : le premier, faute de mieux.
 */
function pickVideo(input: VideoInput | undefined): VideoSource | null {
  if (!input) return null;
  if (typeof input === 'string') return input ? { src: input } : null;
  if (!input.length) return null;
  for (const candidate of input) {
    if (candidate.media && typeof matchMedia === 'function' && !matchMedia(candidate.media).matches) continue;
    if (candidate.type) {
      probeVideo ??= document.createElement('video');
      if (probeVideo.canPlayType(candidate.type) === '') continue;
    }
    return candidate;
  }
  return input[0];
}

function validCrop(crop: FrameCrop | undefined): FrameCrop | null {
  if (!crop || !(crop.width > 0) || !(crop.height > 0)) return null;
  return crop;
}

/**
 * Table de correspondance scroll → vidéo, sous forme de points [scroll, vidéo] croissants.
 * Chaque morceau de vidéo reçoit une part de scroll proportionnelle à son poids :
 * poids du rythme (`pace`, par tranche) × facteur des ralentis qui le couvrent.
 */
function buildTimeline(
  slowdowns: ScrollFramesOptions['slowdowns'],
  pace: ScrollFramesOptions['pace'],
): [number, number][] | null {
  const zones = (slowdowns ?? [])
    .map((z) => ({ from: clamp(z.from), to: clamp(z.to), factor: Math.max(0.05, z.factor) }))
    .filter((z) => z.to > z.from);
  const slices = (pace ?? []).map((w) => (Number.isFinite(w) && w > 0 ? w : 1));
  if (!zones.length && !slices.length) return null;

  const cuts = new Set([0, 1]);
  slices.forEach((_, i) => cuts.add(i / slices.length));
  zones.forEach((z) => cuts.add(z.from).add(z.to));
  const points = [...cuts].sort((a, b) => a - b);

  const weightAt = (m: number) => {
    let w = slices.length ? slices[Math.min(slices.length - 1, Math.floor(m * slices.length))] : 1;
    for (const z of zones) if (m >= z.from && m < z.to) w *= z.factor;
    return w;
  };

  const knots: [number, number][] = [[0, 0]]; // [scroll cumulé, vidéo]
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    total += (b - a) * weightAt((a + b) / 2);
    knots.push([total, b]);
  }
  return knots.map(([s, m]) => [s / total, m]);
}

/** Interpolation linéaire dans une table croissante (recherche dichotomique). */
function interpolate(knots: [number, number][], value: number, from: 0 | 1, to: 0 | 1) {
  let lo = 0;
  let hi = knots.length - 1;
  if (value <= knots[0][from]) return knots[0][to];
  if (value >= knots[hi][from]) return knots[hi][to];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (knots[mid][from] <= value) lo = mid;
    else hi = mid;
  }
  const a = knots[lo];
  const b = knots[hi];
  const span = b[from] - a[from];
  return span ? a[to] + ((value - a[from]) / span) * (b[to] - a[to]) : b[to];
}

function parseFocus(value: string): [number, number] {
  const parts = value.trim().split(/\s+/);
  const f = (s: string) => clamp(parseFloat(s) / (s.includes('%') ? 100 : 1));
  return [f(parts[0] ?? '50%'), f(parts[1] ?? parts[0] ?? '50%')];
}

// ---------------------------------------------------------------- écouteurs globaux partagés
const instances = new Set<ScrollFramesEngine>();

function onScroll() {
  instances.forEach((i) => i.update());
}
function onResize() {
  instances.forEach((i) => i.resize());
}
function attachGlobal() {
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
}
function detachGlobal() {
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onResize);
}

export class ScrollFramesEngine {
  readonly section: HTMLElement;
  readonly sticky: HTMLElement;
  readonly canvas: HTMLCanvasElement;

  /** Progression réelle du scroll (0..1) */
  progress = 0;
  /** Progression lissée, utilisée pour tout le rendu (0..1) */
  current = 0;
  frame = 0;
  count = 1;
  loaded = 0;
  failed = 0;
  ready = false;
  /**
   * Rectangle (px CSS, relatif au conteneur sticky) qu'occupe l'image de référence : c'est dans ce repère que
   * s'expriment les positions 0..1 (toScreen, fromScreen). Une vidéo recadrée (`crop`) en dessine une partie.
   */
  drawRect = { x: 0, y: 0, width: 0, height: 0 };

  private opts: typeof DEFAULTS & ScrollFramesOptions;
  private ctx: CanvasRenderingContext2D;
  private focus: [number, number];
  private src = '';
  private sourceKey = '';
  private images: (HTMLImageElement | undefined)[] = [];
  private readyCount = 1;
  private generation = 0;
  private started = false;
  private raf = 0;
  private lastTime = 0;
  private dirty = true;
  private lastSource: CurrentSource | null = null;
  private video: HTMLVideoElement | null = null;
  /** Vidéo choisie parmi les candidats (mode vidéo) */
  private videoSource: VideoSource | null = null;
  /** Recadrage de la vidéo lue par rapport à l'image de référence */
  private crop: FrameCrop | null = null;
  private videoObjectUrl: string | null = null;
  private videoAbort: AbortController | null = null;
  private videoBytes = 0;
  private videoSizeUnknown = false;
  private videoPending: number | null = null;
  private videoLoad = 0;
  private lastLoadStep = '';
  private timeline: [number, number][] | null = null;
  private timelineKey = '';
  private steps = new Set<StepEntry>();
  private counters = new Set<CounterEntry>();
  private frameLabels = new Set<HTMLElement>();
  private handlers = new Map<keyof EngineEvents, Set<(detail: unknown) => void>>();
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  /** Densité de pixels surveillée (zoom du navigateur, fenêtre déplacée sur un autre écran) */
  private dprQuery: MediaQueryList | null = null;
  private anchor: { width: number; after: boolean; value: number; before?: boolean } | null = null;
  /** jumpTo() en attente de l'image d'arrivée */
  private paintWaiters = new Set<() => void>();
  /** Taille de l'image source (vidéo ou image) et du conteneur (px CSS), gardées en cache : pas de lecture du DOM à chaque image */
  private srcW = 0;
  private srcH = 0;
  private boxW = 0;
  private boxH = 0;
  /** Barres de progression (collections vivantes) : seules à recevoir --sf-progress à chaque image */
  private progressBars: HTMLCollectionOf<Element>[] = [];
  private lastSectionProgress = '';
  /** Nombre d'images de la vidéo réellement lue (countMobile, ou `count` du candidat, à une autre cadence) */
  private seekCount = 0;
  /** La vidéo est affichée elle-même à la place du canvas (navigateur qui ne sait pas l'y copier) */
  private directVideo = false;
  private reduceMotion = prefersReducedMotion();
  /** Lecture automatique native en cours (voir startPlayback) */
  private playing = false;
  private playRaf = 0;
  private playSpeedAt: ((progress: number) => number) | null = null;
  private playExpected = -1;
  /** Taille de la fenêtre à l'image précédente de la lecture (plein écran, rotation, barre d'adresse) */
  private playViewport = '';
  private playRate = 1;
  /** Écran tactile : inertie `smoothTouch`, préparation de la vidéo plus courte */
  private coarse = coarsePointer();

  constructor(section: HTMLElement, sticky: HTMLElement, canvas: HTMLCanvasElement, options: ScrollFramesOptions = {}) {
    this.section = section;
    this.sticky = sticky;
    this.canvas = canvas;
    this.opts = { ...DEFAULTS, ...stripUndefined(options) };
    // en cover l'image recouvre tout le canvas : un canvas opaque évite au navigateur de le mélanger avec le fond
    // à chaque image (fixé à la création : un passage ultérieur en contain laisserait des bandes noires)
    const opaque = this.opts.fit === 'cover' && (this.opts.fitMobile ?? 'cover') === 'cover';
    const ctx = canvas.getContext('2d', { alpha: !opaque });
    if (!ctx) throw new Error('ScrollFrames : canvas 2D indisponible');
    this.ctx = ctx;
    this.focus = parseFocus(this.opts.focus);
    this.tick = this.tick.bind(this);
    this.onVideoSeeked = this.onVideoSeeked.bind(this);
    this.onDprChange = this.onDprChange.bind(this);
    this.playTick = this.playTick.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    this.progressBars = [section.getElementsByClassName('sf-progress-x'), section.getElementsByClassName('sf-progress-y')];

    this.setSource();
    this.resize();

    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(sticky);
    }
    this.watchDpr();
    this.observe();

    if (instances.size === 0) attachGlobal();
    instances.add(this);
    this.update();
    this.current = this.progress;
    this.render(this.current);
  }

  // ------------------------------------------------------------ options & sources
  setOptions(options: ScrollFramesOptions) {
    const prev = this.opts;
    this.opts = { ...this.opts, ...stripUndefined(options) };
    if (prev.focus !== this.opts.focus) this.focus = parseFocus(this.opts.focus);
    this.fitVideo();
    this.setSource(); // ne recharge que si la source a réellement changé
    this.update(); // les ralentis ont pu changer
    this.dirty = true;
    this.kick();
  }

  /**
   * Téléphone ou petite tablette, d'après le petit côté de l'écran : la même vidéo est gardée
   * en portrait et en paysage (un téléphone à l'horizontale dépasse 768 px de large, et changer
   * de source en tournant l'appareil relancerait tout le téléchargement).
   */
  private isMobile() {
    const w = window.screen?.width || window.innerWidth;
    const h = window.screen?.height || window.innerHeight;
    return Math.min(w, h) < this.opts.breakpoint;
  }

  private currentFit(): Fit {
    return (this.isMobile() && this.opts.fitMobile) || this.opts.fit;
  }

  private setSource() {
    const timelineKey = JSON.stringify([this.opts.slowdowns ?? [], this.opts.pace ?? []]);
    if (timelineKey !== this.timelineKey) {
      this.timelineKey = timelineKey;
      this.timeline = buildTimeline(this.opts.slowdowns, this.opts.pace);
    }
    const { frames } = this.opts;
    // vidéo : les candidats mobiles sous le breakpoint (sinon, ou si aucun ne convient, les candidats ordinateur)
    const mobilePick = this.opts.video && this.opts.videoMobile && this.isMobile() ? pickVideo(this.opts.videoMobile) : null;
    const video = mobilePick ?? pickVideo(this.opts.video);
    const usesMobileVideo = mobilePick !== null;
    const mobile = Boolean(!video && this.opts.srcMobile && this.isMobile());
    const src = video ? video.src : mobile ? this.opts.srcMobile! : this.opts.src;
    const count = video
      ? this.opts.count || 1
      : frames ? frames.length : mobile ? this.opts.countMobile || this.opts.count : this.opts.count;
    const crop = video ? validCrop(video.crop) : null;
    const key = [
      video ? 'video' : 'frames',
      src,
      count,
      frames?.[0],
      frames?.[frames.length - 1],
      crop && [crop.x, crop.y, crop.width, crop.height].join(','),
    ].join('|');
    if (key === this.sourceKey) return;

    this.sourceKey = key;
    this.src = src;
    this.videoSource = video;
    this.crop = crop;
    this.seekCount = video ? video.count || (usesMobileVideo && this.opts.countMobile) || 0 : 0;
    this.count = Math.max(1, Math.floor(count));
    this.generation++;
    this.teardownVideo();
    this.images = video ? [] : new Array(this.count);
    this.loaded = this.failed = 0;
    this.videoLoad = 0;
    this.videoBytes = 0;
    this.setSizeUnknown(false);
    this.ready = false;
    this.lastSource = null;
    this.readyCount = Math.min(this.count, Math.ceil(this.count / 8) + 1);
    this.setState('loading');
    delete this.section.dataset.sfComplete;
    if (this.started) this.load();
  }

  url(i: number) {
    if (this.opts.frames) return this.opts.frames[i];
    const n = this.opts.start + i;
    return this.src.replace(/\{index\}/g, String(n).padStart(this.opts.pad, '0')).replace(/\{n\}/g, String(n));
  }

  /** Ordre progressif : extrémités, puis 1 image sur 64, 32, 16… → le scrub fonctionne très tôt */
  private loadOrder(count: number) {
    const order: number[] = [];
    const seen = new Uint8Array(count);
    const push = (i: number) => {
      if (i >= 0 && i < count && !seen[i]) {
        seen[i] = 1;
        order.push(i);
      }
    };
    push(0);
    push(count - 1);
    for (let step = 2 ** Math.floor(Math.log2(Math.max(1, count))); step >= 1; step >>= 1) {
      for (let i = 0; i < count; i += step) push(i);
    }
    return order;
  }

  private observe() {
    // Section déjà proche de l'écran (cas du hero) : on n'attend pas l'IntersectionObserver
    // (innerHeight peut valoir 0 dans un onglet ou un iframe pas encore affiché : on prend une valeur de repli)
    const vh = window.innerHeight || document.documentElement.clientHeight || 800;
    const rect = this.section.getBoundingClientRect();
    const near = rect.top <= vh * 2.5 && rect.bottom >= -vh * 1.5;
    if (this.opts.eager || near || !('IntersectionObserver' in window)) {
      this.start();
      return;
    }
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.intersectionObserver?.disconnect();
          this.start();
        }
      },
      { rootMargin: '150% 0px' },
    );
    this.intersectionObserver.observe(this.section);
  }

  /** Démarre le préchargement (appelé automatiquement) */
  start() {
    if (this.started) return;
    this.started = true;
    this.load();
  }

  private load() {
    const gen = this.generation;
    if (this.videoSource) {
      void this.loadVideo(gen);
      return;
    }
    const queue = this.loadOrder(this.count);
    let active = 0;

    const next = () => {
      if (gen !== this.generation) return;
      while (active < this.opts.concurrency && queue.length) fetchFrame(queue.shift()!);
    };
    const fetchFrame = (i: number) => {
      active++;
      const img = new Image();
      img.decoding = 'async';
      // « load » se déclenche même onglet masqué (contrairement à decode()),
      // puis on pré-décode en tâche de fond pour que le premier affichage soit instantané.
      img.onload = () => {
        img.decode().catch(() => {});
        done(i, img);
      };
      img.onerror = () => done(i, null);
      img.src = this.url(i);
    };
    const done = (i: number, img: HTMLImageElement | null) => {
      if (gen !== this.generation) return;
      active--;
      if (img) this.images[i] = img;
      else {
        if (!this.failed) console.warn('[ScrollFrames] image introuvable :', this.url(i));
        this.failed++;
        this.emit('error', { url: this.url(i) });
      }
      this.loaded++;
      this.onLoadProgress();
      next();
    };
    next();
  }

  private onLoadProgress() {
    const s = this.section;
    const toReady = clamp(this.loaded / this.readyCount);
    s.style.setProperty('--sf-load', (this.loaded / this.count).toFixed(3));
    s.style.setProperty('--sf-load-ready', toReady.toFixed(3));
    this.emit('load', { loaded: this.loaded, total: this.count, ready: toReady });

    if (this.failed === this.count) {
      this.setState('error');
      return;
    }
    if (!this.ready && this.images[0] && this.loaded >= this.readyCount) {
      this.ready = true;
      this.setState('ready');
      this.emit('ready', { total: this.count });
    }
    if (this.loaded === this.count) {
      s.dataset.sfComplete = '';
      this.emit('loaded', { failed: this.failed });
    }
    this.dirty = true;
    this.kick();
  }

  // ------------------------------------------------------------ mode vidéo
  /**
   * Télécharge la vidéo entière en mémoire (les recherches deviennent instantanées, sans requête réseau à chaque
   * image), puis la parcourt une première fois pendant l'écran de chargement : la barre suit le téléchargement
   * réel (90 %) puis cette préparation (10 %). Aucune détection de navigateur : si le téléchargement échoue
   * (serveur sans CORS) ou si le navigateur refuse la vidéo en mémoire, elle est lue en streaming.
   */
  private async loadVideo(gen: number) {
    const url = this.src;
    const abort = new AbortController();
    this.videoAbort = abort;

    let local: string | null = null;
    try {
      local = await this.download(url, abort.signal, gen);
    } catch {
      // serveur sans CORS, réseau coupé… : la vidéo sera lue en streaming
    }
    if (gen !== this.generation) return;
    this.setSizeUnknown(false);
    this.onVideoProgress(VIDEO_DOWNLOAD_SHARE);

    let v: HTMLVideoElement | null = null;
    if (local) {
      this.videoObjectUrl = local;
      v = await openVideo(local, OPEN_LOCAL_TIMEOUT);
      if (gen !== this.generation) {
        if (v) discardVideo(v);
        return;
      }
      if (!v) {
        console.info('[ScrollFrames] vidéo en mémoire refusée par le navigateur : lecture en streaming');
        this.revokeObjectUrl();
      }
    }
    if (!v) v = await openVideo(url, OPEN_STREAM_TIMEOUT);
    if (gen !== this.generation) {
      if (v) discardVideo(v);
      return;
    }
    if (!v) {
      console.warn('[ScrollFrames] vidéo illisible :', url);
      this.failed = 1;
      this.setState('error');
      this.emit('error', { url });
      this.emit('load', { loaded: 0, total: 1, ready: 0 });
      return;
    }

    // vidéo entière en mémoire : on la parcourt une fois pour que le scrub soit fluide dès le premier scroll
    // (en streaming, ce parcours téléchargerait tout le fichier image par image : on s'en passe)
    if (this.videoObjectUrl) await this.warmUpVideo(v, gen);
    if (gen !== this.generation) {
      discardVideo(v);
      return;
    }

    v.addEventListener('seeked', this.onVideoSeeked);
    this.video = v;
    if (!canvasDrawsVideo(v)) this.showVideo(v);
    this.count = this.opts.count || Math.max(1, Math.round(v.duration * 30));
    this.onVideoProgress(1);
    this.ready = true;
    this.setState('ready');
    this.section.dataset.sfComplete = '';
    this.emit('ready', { total: this.count });
    this.emit('loaded', { failed: 0 });
    this.dirty = true;
    this.seekVideo(this.current);
    this.kick();
  }

  /** Téléchargement complet avec progression ; renvoie l'adresse blob de la vidéo en mémoire (null si abandonné). */
  private async download(url: string, signal: AbortSignal, gen: number) {
    const res = await fetch(url, { signal });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const total = res.headers.get('content-encoding') ? 0 : Number(res.headers.get('content-length')) || 0;
    if (!total) this.setSizeUnknown(true);

    const reader = res.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (gen !== this.generation) {
        void reader.cancel();
        return null;
      }
      if (done) break;
      chunks.push(value as Uint8Array<ArrayBuffer>);
      received += value.length;
      this.videoBytes = received;
      this.onVideoProgress(total ? Math.min(1, received / total) * VIDEO_DOWNLOAD_SHARE : 0);
    }
    return URL.createObjectURL(new Blob(chunks, { type: res.headers.get('content-type') || 'video/mp4' }));
  }

  /**
   * Premier passage dans toute la vidéo : le navigateur lit et décode chaque portion une fois
   * pendant l'écran de chargement, et le scrub est fluide dès le premier scroll.
   * Plus court sur téléphone (chaque recherche y est plus lente, et l'attente compte double).
   */
  private async warmUpVideo(v: HTMLVideoElement, gen: number) {
    if (!Number.isFinite(v.duration) || v.duration <= 0) return;
    const end = Math.max(0, v.duration - 0.05);
    const steps = this.coarse
      ? Math.round(clamp(v.duration / 4, 8, 30)) // un arrêt toutes les ~4 s
      : Math.round(clamp(v.duration / 2, 12, 60)); // un arrêt toutes les ~2 s
    for (let i = 1; i <= steps; i++) {
      await seekAndWait(v, (i / steps) * end);
      if (gen !== this.generation) return;
      this.onVideoProgress(VIDEO_DOWNLOAD_SHARE + (1 - VIDEO_DOWNLOAD_SHARE) * (i / steps));
    }
  }

  private setSizeUnknown(unknown: boolean) {
    if (unknown === this.videoSizeUnknown) return;
    this.videoSizeUnknown = unknown;
    this.section.toggleAttribute('data-sf-indeterminate', unknown);
  }

  private onVideoProgress(p: number) {
    this.videoLoad = p;
    this.section.style.setProperty('--sf-load', p.toFixed(3));
    this.section.style.setProperty('--sf-load-ready', p.toFixed(3));
    // l'écran de chargement (state React) n'est prévenu qu'à chaque % ou Mo gagné, pas à chaque paquet reçu
    const step = `${Math.floor(p * 100)}|${Math.floor(this.videoBytes / 1e6)}|${this.videoSizeUnknown}`;
    if (step === this.lastLoadStep) return;
    this.lastLoadStep = step;
    this.emit('load', { loaded: Math.round(p * 100), total: 100, ready: p });
  }

  /**
   * Une seule recherche à la fois : la dernière position demandée est appliquée dès que la vidéo est prête.
   * La position est arrondie à l'image : tant qu'on reste sur la même image, aucune nouvelle recherche
   * (chaque recherche fait décoder depuis l'image clé précédente, très coûteux sur téléphone).
   */
  private seekVideo(progress: number) {
    const v = this.video;
    if (!v || this.playing) return; // en lecture native, c'est la vidéo qui mène
    const n = this.seekCount || this.count;
    const f = Math.round(progress * (n - 1));
    const time = Math.min(Math.max(0, v.duration - 0.02), ((f + 0.5) * v.duration) / n);
    if (v.seeking) {
      this.videoPending = time;
      return;
    }
    if (Math.abs(v.currentTime - time) > 0.0005) v.currentTime = time;
  }

  private onVideoSeeked() {
    const v = this.video;
    if (!v) return;
    this.paint(v, v.videoWidth, v.videoHeight);
    if (this.videoPending !== null) {
      const time = this.videoPending;
      this.videoPending = null;
      if (Math.abs(v.currentTime - time) > 0.0005) {
        v.currentTime = time;
        return;
      }
    }
    this.paintWaiters.forEach((done) => done());
  }

  /**
   * Secours quand le canvas reste vide (Firefox Android) : la vidéo est posée dans la page, sous le canvas masqué,
   * et cadrée comme lui (object-fit, object-position) ; les points et les étapes gardent leurs positions.
   */
  private showVideo(v: HTMLVideoElement) {
    console.info('[ScrollFrames] canvas vide avec la vidéo : affichage direct de la vidéo');
    this.directVideo = true;
    v.className = 'sf-video';
    v.setAttribute('aria-hidden', 'true');
    this.canvas.before(v);
    this.canvas.style.visibility = 'hidden';
    this.fitVideo();
  }

  private fitVideo() {
    const v = this.video;
    if (!v || !this.directVideo) return;
    v.style.objectFit = this.currentFit();
    v.style.objectPosition = `${this.focus[0] * 100}% ${this.focus[1] * 100}%`;
  }

  private revokeObjectUrl() {
    if (this.videoObjectUrl) URL.revokeObjectURL(this.videoObjectUrl);
    this.videoObjectUrl = null;
  }

  private teardownVideo() {
    this.stopPlayback();
    this.videoAbort?.abort(); // coupe un téléchargement en cours (changement de source, démontage)
    this.videoAbort = null;
    this.lastLoadStep = '';
    if (this.video) {
      if (this.directVideo) {
        this.video.remove();
        this.canvas.style.visibility = '';
        this.directVideo = false;
      }
      this.video.removeEventListener('seeked', this.onVideoSeeked);
      discardVideo(this.video);
      this.video = null;
    }
    this.revokeObjectUrl();
    this.videoPending = null;
  }

  /** État exposé en data-sf-state sur la section (loading | ready | error) pour le CSS */
  private setState(state: 'loading' | 'ready' | 'error') {
    this.section.dataset.sfState = state;
  }

  /** Avancement du préchargement jusqu'au seuil « prêt à scroller » (0..1) */
  get readyProgress() {
    return this.videoSource ? this.videoLoad : clamp(this.loaded / this.readyCount);
  }

  /** Octets de vidéo reçus */
  get loadedBytes() {
    return this.videoBytes;
  }

  /** Taille de la vidéo inconnue (le serveur ne l'indique pas) : pas de pourcentage possible */
  get loadIndeterminate() {
    return this.videoSizeUnknown;
  }

  get hasError() {
    return this.videoSource ? this.failed > 0 : this.loaded === this.count && this.failed === this.count;
  }

  /** Durée réelle de la vidéo lue, en secondes (0 tant qu'elle n'est pas connue, ou séquence d'images) */
  get videoDuration() {
    const v = this.video;
    return v && Number.isFinite(v.duration) ? v.duration : 0;
  }

  /** Image (ou vidéo) actuellement affichée, avec ses dimensions — pratique pour recadrer un détail. */
  get currentSource(): CurrentSource | null {
    return this.lastSource;
  }

  /** Position normalisée dans l'image de référence (0..1) → px CSS dans le conteneur sticky. */
  toScreen(x: number, y: number) {
    const r = this.drawRect;
    return { x: r.x + x * r.width, y: r.y + y * r.height };
  }

  /** Point de l'écran (clientX / clientY) → position normalisée dans l'image de référence (0..1). */
  fromScreen(clientX: number, clientY: number) {
    const box = this.sticky.getBoundingClientRect();
    const r = this.drawRect;
    return { x: (clientX - box.left - r.x) / (r.width || 1), y: (clientY - box.top - r.y) / (r.height || 1) };
  }

  // ------------------------------------------------------------ scroll & boucle de rendu
  update() {
    const rect = this.section.getBoundingClientRect();
    const total = Math.max(1, rect.height - window.innerHeight);
    const scroll = clamp(-rect.top / total);
    const p = this.timeline ? interpolate(this.timeline, scroll, 0, 1) : scroll;
    if (p !== this.progress) {
      this.progress = p;
      this.kick();
    }
    this.saveAnchor(rect, total);
  }

  /**
   * Mémorise où en est le visiteur (dans la visite, ou N px après sa fin), pour le remettre
   * au même endroit quand il tourne son téléphone : la hauteur de la section suit celle de
   * l'écran, et sans ça le navigateur garde le même scrollY et le renvoie au milieu de la visite.
   */
  private saveAnchor(rect: DOMRect, total: number) {
    const width = window.innerWidth;
    if (this.anchor && this.anchor.width !== width) return; // rotation en cours : on garde la position d'avant
    if (rect.top > 0) this.anchor = { width, after: false, value: 0, before: true };
    else if (rect.bottom > window.innerHeight) this.anchor = { width, after: false, value: -rect.top / total };
    else this.anchor = { width, after: true, value: window.innerHeight - rect.bottom };
  }

  /** Après une rotation (la largeur change ; la barre d'adresse ne change que la hauteur). */
  private restoreAnchor() {
    const a = this.anchor;
    if (!a || a.width === window.innerWidth) return;
    this.anchor = null;
    if (a.before) return;
    const rect = this.section.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const total = Math.max(1, rect.height - window.innerHeight);
    const y = a.after ? top + total + a.value : top + total * a.value;
    window.scrollTo({ top: y, behavior: 'instant' });
  }

  resize() {
    this.restoreAnchor();
    this.coarse = coarsePointer();
    this.boxW = this.sticky.clientWidth;
    this.boxH = this.sticky.clientHeight;
    this.sizeCanvas();
    this.fitVideo();
    this.setSource(); // un candidat vidéo lié à l'orientation (`media`) a pu changer
    this.dirty = true;
    this.update();
    this.kick();
    // lecture automatique : la page a pu bouger avec le redimensionnement (ancre de rotation) ; ce n'est pas le visiteur
    if (this.playing) this.playExpected = -1;
  }

  /** Surveille la densité de pixels : elle change avec le zoom du navigateur ou un déplacement sur un autre écran. */
  private watchDpr() {
    if (typeof matchMedia !== 'function') return;
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    this.dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    this.dprQuery.addEventListener('change', this.onDprChange);
  }

  private onDprChange() {
    this.resize();
    this.watchDpr();
  }

  /**
   * Taille du canvas : densité de l'écran (plafonnée par `dpr`), mais jamais plus de pixels que l'image source
   * n'en apporte à l'écran. Au-delà, le navigateur agrandirait chaque image vidéo pour rien (coûteux sur téléphone) :
   * l'agrandissement final est laissé au CSS, fait par la carte graphique. Tant que la source est inconnue,
   * le canvas reste en 1× (rien n'y est dessiné) : pas de grand tampon alloué pour rien.
   */
  private sizeCanvas() {
    if (!this.boxW || !this.boxH) return;
    let dpr = 1;
    if (this.srcW && this.srcH) {
      dpr = Math.min(window.devicePixelRatio || 1, this.opts.dpr);
      const scale =
        this.currentFit() === 'contain'
          ? Math.min(this.boxW / this.srcW, this.boxH / this.srcH)
          : Math.max(this.boxW / this.srcW, this.boxH / this.srcH);
      dpr = Math.min(dpr, Math.max(1, 1 / scale));
    }
    const w = Math.round(this.boxW * dpr);
    const h = Math.round(this.boxH * dpr);
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w;
      this.canvas.height = h;
      // redimensionner un canvas réinitialise son contexte
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.dirty = true;
    }
  }

  private kick() {
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  /** Inertie effective : `smooth`, ou sur écran tactile `smoothTouch` (sans jamais être plus doux que `smooth`). */
  private smoothing() {
    if (this.reduceMotion) return 1;
    const base = clamp(this.opts.smooth, 0.01, 1);
    return this.coarse ? Math.max(base, clamp(this.opts.smoothTouch, 0.01, 1)) : base;
  }

  private tick(now: number) {
    this.raf = 0;
    const dt = this.lastTime ? Math.min(64, now - this.lastTime) : 16.7;
    this.lastTime = now;
    const k = 1 - Math.pow(1 - this.smoothing(), dt / 16.7); // lissage indépendant du taux de rafraîchissement
    let c = this.playing ? this.progress : this.current + (this.progress - this.current) * k;
    if (Math.abs(this.progress - c) < 0.0001) c = this.progress;
    const changed = c !== this.current;
    this.current = c;
    if (changed || this.dirty) this.render(c);
    if (c !== this.progress) this.kick();
    else this.lastTime = 0;
  }

  private render(c: number) {
    // barres de progression à chaque image ; la section (dont hérite toute la visite) seulement par pas de 1 %,
    // sinon le navigateur recalcule le style de tout ce qu'elle contient à chaque image
    const progress = c.toFixed(4);
    for (const bars of this.progressBars) {
      for (let i = 0; i < bars.length; i++) (bars[i] as HTMLElement).style.setProperty('--sf-progress', progress);
    }
    const coarse = c.toFixed(2);
    if (coarse !== this.lastSectionProgress) {
      this.lastSectionProgress = coarse;
      this.section.style.setProperty('--sf-progress', coarse);
    }
    this.steps.forEach((s) => this.renderStep(s, c));
    this.counters.forEach((ct) => this.renderCounter(ct, c));
    const f = Math.round(c * (this.count - 1));
    if (f !== this.frame || this.dirty) {
      this.frame = f;
      this.frameLabels.forEach((el) => this.renderFrameLabel(el));
    }
    if (this.video) this.seekVideo(c);
    this.draw(f);
    this.emit('progress', { progress: c, frame: f });
  }

  private nearest(i: number) {
    const imgs = this.images;
    if (imgs[i]) return imgs[i]!;
    for (let d = 1; d < this.count; d++) {
      if (imgs[i - d]) return imgs[i - d]!;
      if (imgs[i + d]) return imgs[i + d]!;
    }
    return null;
  }

  private draw(index: number) {
    if (this.video) {
      // en mode vidéo, l'image change à l'événement « seeked » ; ici on ne redessine qu'après un redimensionnement
      if (this.dirty && this.ready) this.paint(this.video, this.video.videoWidth, this.video.videoHeight);
      return;
    }
    const img = this.nearest(index);
    if (!img || (img === this.lastSource?.source && !this.dirty)) return;
    this.paint(img, img.naturalWidth, img.naturalHeight);
  }

  private paint(source: CanvasImageSource, iw: number, ih: number) {
    if (!iw || !ih) return;
    if (iw !== this.srcW || ih !== this.srcH) {
      this.srcW = iw;
      this.srcH = ih;
      this.sizeCanvas();
    }
    const crop = this.crop ?? FULL_FRAME;
    this.lastSource = {
      source,
      width: iw,
      height: ih,
      frame: { x: (-crop.x * iw) / crop.width, y: (-crop.y * ih) / crop.height, width: iw / crop.width, height: ih / crop.height },
    };
    this.dirty = false;
    const { width: cw, height: ch } = this.canvas;
    const fit = this.currentFit();
    const s = fit === 'contain' ? Math.min(cw / iw, ch / ih) : Math.max(cw / iw, ch / ih);
    const dw = iw * s;
    const dh = ih * s;
    const dx = (cw - dw) * this.focus[0];
    const dy = (ch - dh) * this.focus[1];
    // vidéo affichée directement : seul le cadrage (drawRect) est calculé, rien à dessiner
    if (!this.directVideo) {
      // en « cover », l'image recouvre tout le canvas : inutile de l'effacer avant
      if (fit === 'contain') this.ctx.clearRect(0, 0, cw, ch);
      this.ctx.drawImage(source, dx, dy, dw, dh);
    }
    // px canvas → px CSS (taille du conteneur en cache : pas de lecture du DOM), puis de la vidéo dessinée
    // à l'image de référence dont elle est éventuellement un recadrage
    const k = this.boxW / cw || 1;
    const fw = dw / crop.width;
    const fh = dh / crop.height;
    this.drawRect = { x: (dx - fw * crop.x) * k, y: (dy - fh * crop.y) * k, width: fw * k, height: fh * k };
  }

  // ------------------------------------------------------------ contenus synchronisés
  /** Enregistre un bloc animé entre deux progressions. Retourne la fonction de désinscription. */
  addStep(node: HTMLElement, cfg: StepConfig) {
    const entry: StepEntry = {
      node,
      a: cfg.in,
      b: cfg.out,
      fade: Math.max(cfg.fade ?? Math.min(0.06, (cfg.out - cfg.in) / 3), 0.0001),
      v: -1,
      p: -1,
    };
    this.steps.add(entry);
    this.renderStep(entry, this.current);
    return () => {
      this.steps.delete(entry);
    };
  }

  private renderStep(s: StepEntry, p: number) {
    const local = clamp((p - s.a) / (s.b - s.a || 1));
    let v = 0;
    if (p >= s.a && p <= s.b) {
      const vin = s.a <= 0 ? 1 : clamp((p - s.a) / s.fade);
      const vout = s.b >= 1 ? 1 : clamp((s.b - p) / s.fade);
      v = smoothstep(Math.min(vin, vout));
    }
    if (v === s.v && local === s.p) return;
    // --sf-e : +1 avant l'entrée, 0 au repos, -1 après la sortie (entrée par le bas, sortie par le haut)
    const e = local < 0.5 ? 1 - v : -(1 - v);
    const st = s.node.style;
    st.setProperty('--sf-p', local.toFixed(4));
    st.setProperty('--sf-v', v.toFixed(4));
    st.setProperty('--sf-e', e.toFixed(4));
    s.node.toggleAttribute('data-visible', v > 0);
    s.node.toggleAttribute('data-active', v >= 0.999);
    s.node.toggleAttribute('inert', v === 0);
    s.v = v;
    s.p = local;
  }

  /** Enregistre un compteur numérique animé (texte mis à jour sans re-render React). */
  addCounter(node: HTMLElement, cfg: CounterConfig) {
    const entry: CounterEntry = {
      node,
      cfg,
      format: new Intl.NumberFormat(cfg.locale || document.documentElement.lang || undefined, {
        minimumFractionDigits: cfg.decimals ?? 0,
        maximumFractionDigits: cfg.decimals ?? 0,
      }),
      last: '',
    };
    this.counters.add(entry);
    this.renderCounter(entry, this.current);
    return () => {
      this.counters.delete(entry);
    };
  }

  private renderCounter(c: CounterEntry, p: number) {
    const [a, b] = c.cfg.range;
    const t = easeOut(clamp((p - a) / (b - a || 1)));
    const value = c.format.format(c.cfg.from + (c.cfg.to - c.cfg.from) * t);
    if (value !== c.last) {
      c.node.textContent = value;
      c.last = value;
    }
  }

  /** Enregistre un élément qui affiche le numéro d'image courant. */
  addFrameLabel(node: HTMLElement) {
    this.frameLabels.add(node);
    this.renderFrameLabel(node);
    return () => {
      this.frameLabels.delete(node);
    };
  }

  private renderFrameLabel(node: HTMLElement) {
    node.textContent = String(this.frame + 1).padStart(String(this.count).length, '0');
  }

  // ------------------------------------------------------------ lecture automatique
  /** true pendant la lecture automatique native (startPlayback) */
  get isPlaying() {
    return this.playing;
  }

  /**
   * Lecture automatique par lecture native de la vidéo : le décodeur avance image par image (fluide, sans
   * recherche coûteuse depuis l'image clé, ce qui saccade sur téléphone) et la page défile pour suivre la vidéo ;
   * étapes, compteurs, points et itinéraire restent synchronisés comme au scroll.
   * `speedAt(progress)` = vitesse voulue, en progression par seconde (convertie en playbackRate, borné à 0,5..2).
   * S'arrête à la fin de la vidéo, dès que le visiteur fait défiler lui-même, ou si l'onglet est masqué
   * (événement « playback »). Renvoie false sans vidéo prête (séquence d'images) : l'appelant fait alors défiler
   * la page lui-même.
   */
  startPlayback(from: number, speedAt: (progress: number) => number): boolean {
    const v = this.video;
    if (!v || !this.ready || this.directVideo) return false;
    if (this.playing) return true;
    this.playing = true;
    this.playSpeedAt = speedAt;
    this.playExpected = -1;
    this.playViewport = `${window.innerWidth}x${window.innerHeight}`;
    const m = clamp(from);
    this.scrollTo(m, 'instant');
    this.update();
    this.progress = this.current = m;
    v.currentTime = Math.min(Math.max(0, v.duration - 0.02), m * v.duration);
    this.applyPlaybackRate(m);
    v.play().catch(() => this.stopPlayback('error'));
    document.addEventListener('visibilitychange', this.onVisibility);
    this.playRaf = requestAnimationFrame(this.playTick);
    this.emit('playback', { playing: true });
    return true;
  }

  /** Arrête la lecture automatique ; la vidéo se recale sur l'image exacte de la progression. */
  stopPlayback(reason: PlaybackStop = 'stop') {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.playRaf);
    this.playRaf = 0;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.playSpeedAt = null;
    const v = this.video;
    if (v) {
      v.pause();
      v.playbackRate = 1;
      this.playRate = 1;
    }
    this.dirty = true;
    this.kick(); // recale la vidéo sur l'image de la progression (la lecture a pu la dépasser d'une fraction)
    this.emit('playback', { playing: false, reason });
  }

  private applyPlaybackRate(m: number) {
    const v = this.video;
    if (!v || !this.playSpeedAt || !Number.isFinite(v.duration)) return;
    const rate = clamp(this.playSpeedAt(m) * v.duration, PLAYBACK_RATE_MIN, PLAYBACK_RATE_MAX);
    if (Math.abs(rate - this.playRate) > 0.01) {
      this.playRate = rate;
      v.playbackRate = rate;
    }
  }

  private playTick() {
    this.playRaf = 0;
    const v = this.video;
    if (!this.playing || !v) return;
    // la fenêtre a changé de taille (plein écran, rotation, barre d'adresse) : la hauteur de la visite suit
    // celle de l'écran et la page bouge toute seule ; ce n'est pas le visiteur, on se recale sans s'arrêter
    const viewport = `${window.innerWidth}x${window.innerHeight}`;
    if (viewport !== this.playViewport) {
      this.playViewport = viewport;
      this.playExpected = -1;
    }
    // le visiteur a fait défiler lui-même (doigt, molette, clavier) : il reprend la main
    if (this.playExpected >= 0 && Math.abs(window.scrollY - this.playExpected) > PLAYBACK_TOLERANCE) {
      this.stopPlayback('user');
      return;
    }
    const m = v.duration ? clamp(v.currentTime / v.duration) : 0;
    if (v.ended || m >= 0.9995) {
      this.scrollTo(1, 'instant');
      this.update();
      this.stopPlayback('end');
      return;
    }
    this.applyPlaybackRate(m);
    this.scrollTo(m, 'instant');
    this.playExpected = window.scrollY;
    this.update(); // ancre de rotation, barres ; la progression exacte vient de la vidéo, pas des pixels de scroll
    this.progress = this.current = m;
    this.paint(v, v.videoWidth, v.videoHeight);
    this.render(m);
    this.playRaf = requestAnimationFrame(this.playTick);
  }

  private onVisibility() {
    if (document.hidden) this.stopPlayback('hidden');
  }

  // ------------------------------------------------------------ événements & API
  on<K extends keyof EngineEvents>(name: K, fn: Handler<K>) {
    const set = this.handlers.get(name) ?? new Set();
    this.handlers.set(name, set);
    const handler = fn as (detail: unknown) => void;
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  private emit<K extends keyof EngineEvents>(name: K, detail: EngineEvents[K]) {
    this.handlers.get(name)?.forEach((fn) => fn(detail));
  }

  /** Fait défiler la page jusqu'à une progression donnée (0..1) de la séquence (en temps de vidéo). */
  scrollTo(progress: number, behavior: ScrollBehavior = 'smooth') {
    const top = this.section.getBoundingClientRect().top + window.scrollY;
    const total = this.section.offsetHeight - window.innerHeight;
    const scroll = this.timeline ? interpolate(this.timeline, clamp(progress), 1, 0) : clamp(progress);
    window.scrollTo({ top: top + total * scroll, behavior });
  }

  /**
   * Saute directement à une progression (0..1, en temps de vidéo), sans lissage : la vidéo ne défile pas
   * en accéléré jusque-là (à masquer derrière un fondu). Résolue quand l'image d'arrivée est dessinée.
   */
  jumpTo(progress: number): Promise<void> {
    this.scrollTo(progress, 'instant');
    return this.settle();
  }

  /**
   * Après un déplacement instantané de la page (window.scrollTo sans animation) : cale tout de suite la visite
   * sur la position du scroll, sans lissage. Résolue quand l'image d'arrivée est dessinée.
   */
  settle(): Promise<void> {
    this.update();
    this.current = this.progress;
    this.dirty = true;
    const v = this.video;
    if (!v || !this.ready) {
      this.render(this.current);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.paintWaiters.delete(done);
        resolve();
      };
      const timer = setTimeout(done, 1500); // sécurité : on ne reste jamais bloqué derrière le fondu
      this.paintWaiters.add(done);
      this.render(this.current);
      if (!v.seeking) done(); // déjà sur la bonne image
    });
  }

  destroy() {
    this.generation++;
    this.stopPlayback();
    this.teardownVideo();
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    this.dprQuery = null;
    instances.delete(this);
    if (instances.size === 0) detachGlobal();
    this.handlers.clear();
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
