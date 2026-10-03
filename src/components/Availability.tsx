import { useEffect, useMemo, useState } from 'react';
import type { UiText, VillaData } from '../types';

type Config = NonNullable<VillaData['sections']['contact']['availability']>;
type Range = { from: string; to: string };

const DAY = 86_400_000;
const MONTHS_AHEAD = 12;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const nightsBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);

/**
 * Réservations d'exemple (démo) : séjours de 3 à 9 nuits sur les 12 prochains mois,
 * tirés d'une graine liée au mois courant, pour que la démo reste vivante sans jamais se périmer.
 */
function sampleBookings(today: Date): Range[] {
  let seed = today.getFullYear() * 12 + today.getMonth();
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const out: Range[] = [];
  let d = addDays(today, 2 + Math.floor(rnd() * 5));
  const end = addDays(today, MONTHS_AHEAD * 31);
  while (d < end) {
    const nights = 3 + Math.floor(rnd() * 7);
    out.push({ from: iso(d), to: iso(addDays(d, nights)) });
    d = addDays(d, nights + 2 + Math.floor(rnd() * 10));
  }
  return out;
}

interface AvailabilityProps {
  config: Config;
  lang?: string;
  ui: UiText;
  /** Séjour choisi (arrivée, départ au format AAAA-MM-JJ), ou null quand la sélection est effacée */
  onPick: (dates: { arrival: string; departure: string } | null) => void;
}

/**
 * Calendrier des disponibilités : nuits libres ou réservées, choix de l'arrivée puis du départ.
 * Sources : `booked` (JSON), réservations d'exemple si `sample`, ou `api` (fonction api/availability.js
 * qui lit le calendrier iCal du bien : Google Agenda, Airbnb, Booking…). Une date = une nuit.
 */
export function Availability({ config, lang = 'fr', ui, onPick }: AvailabilityProps) {
  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);
  const [remote, setRemote] = useState<Range[] | null>(null);
  const [month, setMonth] = useState(0);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const minNights = Math.max(1, config.minNights ?? 1);

  useEffect(() => {
    if (!config.api) return;
    const ctrl = new AbortController();
    fetch(config.api, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { booked?: Range[] }) => Array.isArray(d?.booked) && setRemote(d.booked))
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) console.warn('[Availability] calendrier indisponible, dates du JSON affichées :', err);
      });
    return () => ctrl.abort();
  }, [config.api]);

  const sample = remote === null && Boolean(config.sample);
  const booked = useMemo(() => {
    const ranges = remote ?? [...(config.booked ?? []), ...(sample ? sampleBookings(today) : [])];
    const nights = new Set<string>();
    for (const r of ranges) {
      for (let d = parse(r.from); d < parse(r.to); d = addDays(d, 1)) nights.add(iso(d));
    }
    return nights;
  }, [remote, config.booked, sample, today]);

  const free = (a: string, b: string) => {
    for (let d = parse(a); d < parse(b); d = addDays(d, 1)) if (booked.has(iso(d))) return false;
    return true;
  };
  /** Départ possible le jour `key` : après l'arrivée, durée minimale respectée, aucune nuit réservée entre les deux */
  const validEnd = (key: string) => Boolean(start && !end && key > start && nightsBetween(start, key) >= minNights && free(start, key));

  const pick = (key: string) => {
    if (validEnd(key)) {
      setEnd(key);
      onPick({ arrival: start!, departure: key });
      return;
    }
    const isFree = !booked.has(key);
    setStart(isFree ? key : null);
    setEnd(null);
    onPick(null);
  };

  const clear = () => {
    setStart(null);
    setEnd(null);
    onPick(null);
  };

  const first = new Date(today.getFullYear(), today.getMonth() + month, 1);
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // semaine commençant le lundi
  const monthLabel = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(first);
  const dayLabel = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' });
  const shortDate = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long' });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(lang, { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i)),
  );
  const todayKey = iso(today);

  let hint = ui.calendarStart;
  if (start && !end) hint = ui.calendarEnd.replace('{n}', String(minNights));
  if (start && end) {
    hint = ui.calendarSummary
      .replace('{n}', String(nightsBetween(start, end)))
      .replace('{from}', shortDate.format(parse(start)))
      .replace('{to}', shortDate.format(parse(end)));
  }

  return (
    <div className="vl-cal">
      <div className="vl-cal-head">
        <p className="vl-cal-title">{config.title}</p>
        <div className="vl-cal-nav">
          <button type="button" aria-label={ui.calendarPrev} disabled={month === 0} onClick={() => setMonth((m) => m - 1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14.5 6l-6 6 6 6" />
            </svg>
          </button>
          <p className="vl-cal-month" aria-live="polite">
            {monthLabel}
          </p>
          <button
            type="button"
            aria-label={ui.calendarNext}
            disabled={month >= MONTHS_AHEAD - 1}
            onClick={() => setMonth((m) => m + 1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9.5 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="vl-cal-grid" role="group" aria-label={monthLabel}>
        {weekdays.map((w, i) => (
          <span key={`w${i}`} className="vl-cal-wd" aria-hidden="true">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`e${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = new Date(first.getFullYear(), first.getMonth(), i + 1);
          const key = iso(date);
          const past = key < todayKey;
          const isBooked = booked.has(key);
          const asEnd = validEnd(key);
          const state = past ? 'past' : isBooked ? 'booked' : 'free';
          const edge = key === start || key === end;
          const inStay = Boolean(start && end && key > start && key < end);
          const status = past ? '' : isBooked ? ui.calendarBooked : ui.calendarFree;
          return (
            <button
              key={key}
              type="button"
              className="vl-cal-day"
              data-state={state}
              data-edge={edge || undefined}
              data-in={inStay || undefined}
              data-end-ok={asEnd || undefined}
              disabled={past || (isBooked && !asEnd)}
              aria-pressed={edge || inStay}
              aria-label={`${dayLabel.format(date)}${status ? ` · ${status}` : ''}`}
              onClick={() => pick(key)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="vl-cal-foot">
        <p className="vl-cal-hint" aria-live="polite">
          {hint}
          {start && (
            <button type="button" className="vl-cal-clear" onClick={clear}>
              {ui.calendarClear}
            </button>
          )}
        </p>
        <ul className="vl-cal-legend">
          <li data-key="free">{ui.calendarFree}</li>
          <li data-key="booked">{ui.calendarBooked}</li>
          <li data-key="stay">{ui.calendarStay}</li>
        </ul>
      </div>
      {sample && <p className="vl-cal-sample">{ui.calendarSample}</p>}
    </div>
  );
}
