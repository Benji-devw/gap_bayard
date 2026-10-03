import { useRef } from 'react';
import { useSequenceProgress } from '../lib/scroll-frames';
import type { TelemetryPoint } from '../types';
import { cardinal, sampleTelemetry } from '../utils';

interface DroneHudProps {
  telemetry: TelemetryPoint[];
  /** Progression à laquelle le viseur a disparu */
  until: number;
  fps?: number;
  /** Format affiché en bas à droite ({fps} = images par seconde) */
  format: string;
}

const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');

/** Viseur façon drone (REC, timecode, altitude, cap), mis à jour hors React. */
export function DroneHud({ telemetry, until, fps = 24, format }: DroneHudProps) {
  const root = useRef<HTMLDivElement>(null);
  const alt = useRef<HTMLSpanElement>(null);
  const cap = useRef<HTMLSpanElement>(null);
  const time = useRef<HTMLSpanElement>(null);

  useSequenceProgress(({ progress, frame }) => {
    if (!root.current) return;
    const alpha = Math.min(1, Math.max(0, (until - progress) / 0.05));
    root.current.style.opacity = alpha.toFixed(3);
    if (alpha === 0) return;
    const tel = sampleTelemetry(telemetry, progress);
    if (tel && alt.current && cap.current) {
      alt.current.textContent = `${tel[0].toFixed(1)} m`;
      cap.current.textContent = `${Math.round(tel[1])}° ${cardinal(tel[1])}`;
    }
    if (time.current) {
      const secs = frame / fps;
      time.current.textContent = `00:${pad(secs / 60)}:${pad(secs % 60)}:${pad(frame % fps)}`;
    }
  });

  return (
    <div ref={root} className="vl-hud" aria-hidden="true">
      <i className="vl-hud-corner tl" />
      <i className="vl-hud-corner tr" />
      <i className="vl-hud-corner bl" />
      <i className="vl-hud-corner br" />
      <span className="vl-hud-rec">
        <b /> REC
      </span>
      <span ref={time} className="vl-hud-time">
        00:00:00:00
      </span>
      {telemetry.length > 0 && (
        <span className="vl-hud-data">
          ALT <span ref={alt}>—</span>
          <span className="vl-hud-sep" />
          CAP <span ref={cap}>—</span>
        </span>
      )}
      <span className="vl-hud-format">{format.replace('{fps}', String(fps))}</span>
      <span className="vl-hud-cross" />
    </div>
  );
}
