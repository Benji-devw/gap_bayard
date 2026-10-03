import { useRef } from 'react';
import studio from '../data/studio.json';

/** Icônes des étapes (trait 1.5 px, même style que Icon). */
const PATHS: Record<string, string> = {
  chat: 'M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5',
  drone:
    'M9 10h6v4H9zM9 10L6 7M15 10l3-3M9 14l-3 3M15 14l3 3M3.5 7h5M15.5 7h5M3.5 17h5M15.5 17h5',
  camera: 'M3 8h3l2-3h8l2 3h3v11H3zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  palette:
    'M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6s.8-1.7 1.9-1.7H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01',
  cursor: 'M5 3l13 7-5.5 1.8L10 17.5zM13 13l5 5',
  check: 'M4 12.5l5 5L20 6.5',
  rocket:
    'M12 15l-3-3c1.2-4.5 4-7.6 9.5-8.5-.9 5.5-4 8.3-8.5 9.5M9 12H5l2.5-3.5H11M12 15v4l3.5-2.5V13M6.5 17.5c-1 .5-2 2-2 2s1.5-1 2-2',
  key: 'M14 10a4 4 0 1 0-3.5 4L9 15.5V18H6.5v2.5H4V18l6.5-6.5M15.5 8.5h.01',
};

function StepIcon({ name }: { name: string }) {
  return (
    <svg className="vl-studio-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.check} />
    </svg>
  );
}

/** Bouton d'en-tête + popup « Développé par Navart » : la démarche de A à Z.
 * Contenu dans data/studio.json (commun à tous les projets) ; `note` : précision propre au projet
 * (villa.json, `studioNote`), ex. vidéo d'un autre réalisateur sur un site de démonstration. */
export function StudioInfo({ note }: { note?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        className="vl-studio-btn"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        <span className="vl-studio-dot" aria-hidden="true">
          i
        </span>
        <span className="vl-studio-btn-label">{studio.button}</span>
      </button>

      <dialog
        ref={dialogRef}
        className="vl-studio"
        aria-labelledby="vl-studio-title"
        // clic sur le fond (hors du panneau) : fermeture
        onClick={(e) => e.target === e.currentTarget && close()}
      >
        <div className="vl-studio-panel">
          <button type="button" className="vl-studio-close" aria-label="Fermer" onClick={close}>
            ×
          </button>

          <p className="vl-kicker">{studio.kicker}</p>
          <h2 id="vl-studio-title">{studio.title}</h2>
          <p className="vl-studio-intro">{studio.intro}</p>
          {note && <p className="vl-studio-note">{note}</p>}

          <dl className="vl-studio-highlights">
            {studio.highlights.map((h) => (
              <div key={h.label}>
                <dt>{h.value}</dt>
                <dd>{h.label}</dd>
              </div>
            ))}
          </dl>

          <ol className="vl-studio-steps">
            {studio.steps.map((s, i) => (
              <li key={s.title}>
                <span className="vl-studio-step-mark">
                  <StepIcon name={s.icon} />
                </span>
                <div>
                  <h3>
                    <span className="vl-studio-step-num">{String(i + 1).padStart(2, '0')}</span>
                    {s.title}
                    {s.duration && <span className="vl-studio-step-time">{s.duration}</span>}
                  </h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="vl-studio-lists">
            {[studio.prepare, studio.deliverables].map((block) => (
              <div key={block.title}>
                <h3>{block.title}</h3>
                <ul>
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="vl-studio-foot">
            <p>
              Site conçu et développé par <strong>{studio.name}</strong>
              <a className="vl-studio-site" href={studio.site.href} target="_blank" rel="noopener">
                {studio.site.label}
              </a>
            </p>
            <a href={studio.contact.href} className="vl-btn">
              {studio.contact.label}
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
