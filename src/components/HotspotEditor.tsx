import { useState, type MouseEvent } from 'react';
import { analyzeMotion, useSequence, useSequenceProgress } from '../lib/scroll-frames';
import type { Hotspot, TrackPoint } from '../types';
import { round4 } from '../utils';

interface HotspotEditorProps {
  hotspots: Hotspot[];
  onChange: (hotspots: Hotspot[]) => void;
  /** JSON complet de la page (avec les pistes modifiées) */
  getJson: () => string;
  onReset: () => void;
  restored: boolean;
  /** URL de la vidéo (mode vidéo) pour l'analyse du mouvement */
  mediaSrc: string | null;
  onPace: (pace: number[]) => void;
}

const WINDOW = 0.025; // points affichés autour de l'instant courant

/**
 * Mode édition (?edit dans l'URL) : placez les objets à la souris sur n'importe quelle vidéo.
 * Scrollez jusqu'à un instant, cliquez sur l'objet : un point [t, x, y] est ajouté à sa piste.
 */
export function HotspotEditor({ hotspots, onChange, getJson, onReset, restored, mediaSrc, onPace }: HotspotEditorProps) {
  const engine = useSequence();
  const [selectedId, setSelectedId] = useState(hotspots[0]?.id ?? '');
  const [t, setT] = useState(0);
  const [toast, setToast] = useState('');
  const [analysis, setAnalysis] = useState<number | null>(null);
  useSequenceProgress(({ progress }) => setT(round4(progress)));

  const selected = hotspots.find((h) => h.id === selectedId);
  const frame = engine ? Math.round(t * (engine.count - 1)) + 1 : 1;

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 1800);
  };

  const patch = (id: string, changes: Partial<Hotspot>) =>
    onChange(hotspots.map((h) => (h.id === id ? { ...h, ...changes } : h)));

  const addPoint = (e: MouseEvent) => {
    if (!engine || !selected) return;
    const { x, y } = engine.fromScreen(e.clientX, e.clientY);
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    const now = round4(engine.current);
    const track: TrackPoint[] = (selected.track ?? []).filter((p) => Math.abs(p[0] - now) > 0.003);
    track.push([now, round4(x), round4(y)]);
    track.sort((a, b) => a[0] - b[0]);
    patch(selected.id, { track });
  };

  const removeNearest = () => {
    const track = selected?.track ?? [];
    if (!selected || !track.length) return;
    let index = 0;
    track.forEach((p, i) => {
      if (Math.abs(p[0] - t) < Math.abs(track[index][0] - t)) index = i;
    });
    if (Math.abs(track[index][0] - t) > 0.03) return notify('Aucun point à proximité');
    patch(selected.id, { track: track.filter((_, i) => i !== index) });
  };

  const addHotspot = () => {
    let n = hotspots.length + 1;
    while (hotspots.some((h) => h.id === `objet-${n}`)) n++;
    const id = `objet-${n}`;
    onChange([...hotspots, { id, label: 'Nouvel objet', title: 'Nouvel objet', description: '', track: [] }]);
    setSelectedId(id);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(getJson());
    notify('JSON copié dans le presse-papiers');
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([getJson()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'villa.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const analyze = async () => {
    if (!mediaSrc || analysis !== null) return;
    setAnalysis(0);
    try {
      const result = await analyzeMotion(mediaSrc, { onProgress: (p) => setAnalysis(p) });
      onPace(result.pace);
      notify(`Rythme calculé sur ${result.pace.length} tranches`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Analyse impossible');
    } finally {
      setAnalysis(null);
    }
  };

  const markers = selected?.track?.filter((p) => Math.abs(p[0] - t) < WINDOW) ?? [];

  return (
    <>
      <div className="vl-editor-catcher" onClick={addPoint} />
      {engine &&
        markers.map((p) => {
          const s = engine.toScreen(p[1], p[2]);
          return (
            <span
              key={p[0]}
              className="vl-editor-marker"
              style={{ transform: `translate3d(${s.x}px, ${s.y}px, 0)`, opacity: 1 - Math.abs(p[0] - t) / WINDOW }}
            />
          );
        })}

      <aside className="vl-editor" aria-label="Éditeur de hotspots">
        <header>
          <strong>Éditeur de hotspots</strong>
          <span>
            t = {t.toFixed(4)} · image {frame}/{engine?.count ?? '–'}
          </span>
        </header>

        {restored && <p className="vl-editor-note">Brouillon restauré depuis ce navigateur.</p>}

        <div className="vl-editor-row">
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {hotspots.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label} ({h.track?.length ?? 0} pts)
              </option>
            ))}
          </select>
          <button type="button" onClick={addHotspot}>
            + Objet
          </button>
        </div>

        {selected && (
          <div className="vl-editor-fields">
            <label>
              id
              <input value={selected.id} onChange={(e) => {
                const id = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                patch(selected.id, { id });
                setSelectedId(id);
              }} />
            </label>
            <label>
              Nom
              <input value={selected.label} onChange={(e) => patch(selected.id, { label: e.target.value })} />
            </label>
            <label>
              Titre
              <input value={selected.title} onChange={(e) => patch(selected.id, { title: e.target.value })} />
            </label>
          </div>
        )}

        <p className="vl-editor-help">
          Scrollez jusqu'à l'instant voulu, puis <b>cliquez sur l'objet</b> dans l'image. Un point tous les 3 à 5 % du
          parcours suffit : la position est interpolée entre les points.
        </p>

        <div className="vl-editor-row">
          <button type="button" onClick={removeNearest}>
            Supprimer le point proche
          </button>
          <button type="button" onClick={() => selected && patch(selected.id, { track: [] })}>
            Vider la piste
          </button>
        </div>

        {mediaSrc && (
          <button type="button" onClick={analyze} disabled={analysis !== null}>
            {analysis === null
              ? 'Analyser le mouvement (rythme du scroll)'
              : `Analyse du mouvement… ${Math.round(analysis * 100)} %`}
          </button>
        )}

        <div className="vl-editor-row vl-editor-main">
          <button type="button" onClick={copy}>
            Copier le JSON
          </button>
          <button type="button" onClick={download}>
            Télécharger villa.json
          </button>
        </div>
        <button type="button" className="vl-editor-reset" onClick={onReset}>
          Réinitialiser (revenir au fichier villa.json)
        </button>

        {toast && (
          <p className="vl-editor-toast" role="status">
            {toast}
          </p>
        )}
      </aside>
    </>
  );
}
