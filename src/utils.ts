import type { Hotspot, TelemetryPoint, TrackPoint } from './types';

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/** Durée du fondu d'apparition d'un point, réduite sur les plages courtes pour qu'il soit pleinement visible au milieu. */
const FADE = 0.012;
const fadeFor = ([start, end]: [number, number]) => Math.min(FADE, (end - start) / 4);

/** Plages continues d'une piste : deux points plus espacés que `gap` coupent la plage. */
export function trackRuns(track: TrackPoint[], gap: number): [number, number][] {
  const runs: [number, number][] = [];
  track.forEach((p, i) => {
    if (i === 0 || p[0] - track[i - 1][0] > gap) runs.push([p[0], p[0]]);
    else runs[runs.length - 1][1] = p[0];
  });
  return runs;
}

export interface TrackSample {
  x: number;
  y: number;
  /** Opacité 0..1 (fondu aux extrémités de chaque plage visible) */
  alpha: number;
}

/** Piste effective d'un hotspot : `track` s'il a des points, sinon le mode simple `at` converti en piste fixe. */
export function effectiveTrack(h: Hotspot): TrackPoint[] {
  if (h.track && h.track.length > 1) return h.track;
  if (h.at) return [[h.at.from, h.at.x, h.at.y], [h.at.to, h.at.x, h.at.y]];
  return [];
}

/** Position interpolée d'un hotspot à la progression t, ou null s'il n'est pas visible. */
export function sampleTrack(h: Hotspot, runs: [number, number][], t: number, gap: number): TrackSample | null {
  const tr = effectiveTrack(h);
  if (tr.length < 2) return null;
  if (!(h.track && h.track.length > 1)) gap = Infinity; // mode simple : visible sans interruption
  if ((h.in !== undefined && t < h.in) || (h.out !== undefined && t > h.out)) return null;
  if (t < tr[0][0] || t > tr[tr.length - 1][0]) return null;

  let lo = 0;
  let hi = tr.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (tr[mid][0] <= t) lo = mid;
    else hi = mid;
  }
  const a = tr[lo];
  const b = tr[hi];
  if (b[0] - a[0] > gap) return null;
  const k = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);

  const run = runs.find(([s, e]) => t >= s && t <= e);
  if (!run) return null;
  const fade = fadeFor(run);
  // pas de fondu quand la plage touche le tout début ou la toute fin de la vidéo
  const fadeIn = run[0] <= 0.0001 ? 1 : clamp((t - run[0]) / fade);
  const fadeOut = run[1] >= 0.9999 ? 1 : clamp((run[1] - t) / fade);
  let alpha = Math.min(fadeIn, fadeOut);
  if (h.in !== undefined) alpha = Math.min(alpha, clamp((t - h.in) / FADE));
  if (h.out !== undefined) alpha = Math.min(alpha, clamp((h.out - t) / FADE));
  return { x: a[1] + (b[1] - a[1]) * k, y: a[2] + (b[2] - a[2]) * k, alpha };
}

/**
 * Moment où la pièce est pleinement visible et le plus proche du centre de l'image (idéal pour y amener le visiteur).
 * Les instants candidats sont les points de la piste, décalés hors des fondus d'entrée et de sortie.
 */
export function bestMoment(h: Hotspot, gap: number): number | null {
  const track = effectiveTrack(h);
  const runs = trackRuns(track, h.track && h.track.length > 1 ? gap : Infinity);
  let best: number | null = null;
  let score = Infinity;
  for (const p of track) {
    const run = runs.find(([s, e]) => p[0] >= s && p[0] <= e);
    if (!run) continue;
    const fade = fadeFor(run);
    const t = clamp(p[0], run[0] + fade, run[1] - fade);
    const s = sampleTrack(h, runs, t, gap);
    if (!s) continue;
    const d = Math.hypot(s.x - 0.5, (s.y - 0.5) * 1.4) + (1 - s.alpha) * 2;
    if (d < score) {
      score = d;
      best = t;
    }
  }
  return best === null ? null : round4(best);
}

/** Télémétrie interpolée : [altitude, cap]. */
export function sampleTelemetry(points: TelemetryPoint[], t: number): [number, number] | null {
  if (!points.length) return null;
  if (t <= points[0][0]) return [points[0][1], points[0][2]];
  for (let i = 1; i < points.length; i++) {
    if (t <= points[i][0]) {
      const a = points[i - 1];
      const b = points[i];
      const k = (t - a[0]) / (b[0] - a[0] || 1);
      let dh = b[2] - a[2];
      if (dh > 180) dh -= 360;
      if (dh < -180) dh += 360;
      return [a[1] + (b[1] - a[1]) * k, (a[2] + dh * k + 360) % 360];
    }
  }
  const last = points[points.length - 1];
  return [last[1], last[2]];
}

export function cardinal(deg: number) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(deg / 45) % 8];
}

/** JSON indenté où chaque point [t, x, y] tient sur une ligne : lisible et facile à éditer (humain ou IA). */
export function toJson(value: unknown, level = 0): string {
  const pad = '  '.repeat(level);
  const inner = '  '.repeat(level + 1);
  const isNums = (v: unknown): v is number[] => Array.isArray(v) && v.length > 0 && v.every((n) => typeof n === 'number');
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    if (isNums(value)) return `[${value.join(', ')}]`;
    if (value.every(isNums)) return `[\n${value.map((v) => inner + `[${v.join(', ')}]`).join(',\n')}\n${pad}]`;
    return `[\n${value.map((v) => inner + toJson(v, level + 1)).join(',\n')}\n${pad}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (!entries.length) return '{}';
    return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${toJson(v, level + 1)}`).join(',\n')}\n${pad}}`;
  }
  return JSON.stringify(value);
}

export const round4 = (n: number) => Math.round(n * 10000) / 10000;
