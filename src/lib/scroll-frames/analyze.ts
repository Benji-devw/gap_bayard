/**
 * Analyse du mouvement d'une vidéo, pour régler automatiquement le rythme du scroll.
 * Mesure la différence entre images successives (sur une miniature 48×27 en niveaux de gris) :
 * plus l'image change vite, plus le passage reçoit de scroll. Le résultat alimente l'option `pace`.
 */

export interface MotionAnalysisOptions {
  /** Nombre de tranches (défaut : une par seconde de vidéo) */
  slices?: number;
  /** Mesures par tranche (défaut 4) */
  samplesPerSlice?: number;
  /** Poids minimal et maximal d'une tranche (défaut 0.6 et 3) */
  min?: number;
  max?: number;
  /** Intensité de l'effet : 0 = rythme constant, 1 = proportionnel au mouvement (défaut 1) */
  strength?: number;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

export interface MotionAnalysis {
  /** Poids de scroll par tranche, prêts pour l'option `pace` */
  pace: number[];
  /** Mouvement brut mesuré par tranche (0..255) */
  motion: number[];
  duration: number;
}

const W = 48;
const H = 27;

function loadVideo(url: string) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;
    v.addEventListener('loadeddata', () => resolve(v), { once: true });
    v.addEventListener('error', () => reject(new Error(`Vidéo illisible : ${url}`)), { once: true });
  });
}

function seek(v: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    v.addEventListener('seeked', () => resolve(), { once: true });
    v.currentTime = time;
  });
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function analyzeMotion(url: string, options: MotionAnalysisOptions = {}): Promise<MotionAnalysis> {
  const video = await loadVideo(url);
  const duration = video.duration;
  const slices = Math.max(4, options.slices ?? Math.round(duration));
  const k = Math.max(2, options.samplesPerSlice ?? 4);
  const total = slices * k;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const gray = () => {
    ctx.drawImage(video, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    const g = new Float32Array(W * H);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    return g;
  };

  // mesures régulières sur toute la vidéo, dans l'ordre (les recherches restent rapides)
  const diffs = new Float32Array(total);
  await seek(video, 0);
  let previous = gray();
  for (let s = 1; s <= total; s++) {
    if (options.signal?.aborted) throw new DOMException('Analyse annulée', 'AbortError');
    await seek(video, Math.min(duration - 0.001, (s / total) * duration));
    const current = gray();
    let sum = 0;
    for (let i = 0; i < current.length; i++) sum += Math.abs(current[i] - previous[i]);
    diffs[s - 1] = sum / current.length;
    previous = current;
    options.onProgress?.(s / total);
  }
  video.removeAttribute('src');
  video.load();

  const motion = Array.from({ length: slices }, (_, i) => {
    let sum = 0;
    for (let j = 0; j < k; j++) sum += diffs[i * k + j];
    return sum / k;
  });

  const ref = median(motion) || 1;
  const strength = options.strength ?? 1;
  const min = options.min ?? 0.6;
  const max = options.max ?? 3;
  const raw = motion.map((m) => Math.min(max, Math.max(min, Math.pow(m / ref, strength))));
  // lissage (moyenne glissante sur 3 tranches) pour éviter les à-coups de vitesse
  const pace = raw.map((_, i) => {
    const window = raw.slice(Math.max(0, i - 1), i + 2);
    return Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 100) / 100;
  });
  return { pace, motion: motion.map((m) => Math.round(m * 10) / 10), duration };
}
