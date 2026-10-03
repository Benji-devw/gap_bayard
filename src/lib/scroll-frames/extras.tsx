import { createElement, Fragment, useContext, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { StepContext, useSequence, useSequenceStatus } from './context';
import { cx } from './cx';

/* ------------------------------------------------------------------ Counter */
export interface CounterProps {
  to: number;
  from?: number;
  decimals?: number;
  /** Plage de progression [début, fin]. Par défaut : première moitié de la <Step> parente */
  range?: [number, number];
  locale?: string;
  className?: string;
}

/** Nombre qui s'anime avec le scroll (texte mis à jour hors React, donc sans re-render). */
export function Counter({ to, from = 0, decimals = 0, range, locale, className }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const engine = useSequence();
  const step = useContext(StepContext);
  const [a, b] = range ?? (step ? [step.in, step.in + (step.out - step.in) * 0.5] : [0, 1]);

  useLayoutEffect(() => {
    if (!engine || !ref.current) return;
    return engine.addCounter(ref.current, { from, to, decimals, range: [a, b], locale });
  }, [engine, from, to, decimals, a, b, locale]);

  return <span ref={ref} className={cx('sf-counter', className)} />;
}

/* ------------------------------------------------------------------ FrameNumber */
/** Affiche le numéro de l'image courante (ex. 042). */
export function FrameNumber({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const engine = useSequence();
  useLayoutEffect(() => {
    if (!engine || !ref.current) return;
    return engine.addFrameLabel(ref.current);
  }, [engine]);
  return <span ref={ref} className={className} />;
}

/* ------------------------------------------------------------------ SplitWords */
export interface SplitWordsProps {
  children: string;
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'div' | 'span' | 'blockquote';
  className?: string;
  /** Opacité des mots pas encore révélés (défaut 0.18) */
  dim?: number;
}

/** Texte révélé mot à mot au fil de la <Step> parente (effet « lecture guidée »). */
export function SplitWords({ children, as = 'p', className, dim }: SplitWordsProps) {
  const words = children.split(/\s+/).filter(Boolean);
  const style = { '--n': words.length, ...(dim !== undefined && { '--sf-dim': dim }) } as CSSProperties;
  return createElement(
    as,
    { className: cx('sf-split', className), style },
    words.map((word, i) => (
      <Fragment key={i}>
        <span className="sf-word" style={{ '--i': i } as CSSProperties}>
          {word}
        </span>
        {i < words.length - 1 ? ' ' : null}
      </Fragment>
    )),
  );
}

/* ------------------------------------------------------------------ SequenceLoader */
export interface SequenceLoaderProps {
  label?: ReactNode;
  className?: string;
}

/** Écran de préchargement par défaut. Disparaît dès que la séquence est « scrubbable ». */
export function SequenceLoader({ label, className }: SequenceLoaderProps) {
  const { readyProgress, bytes, indeterminate, error } = useSequenceStatus();
  // taille inconnue : on affiche les Mo reçus plutôt qu'un pourcentage inventé
  const text = error
    ? 'Images introuvables'
    : indeterminate
      ? `${(bytes / 1e6).toFixed(0)} Mo`
      : `${Math.floor(readyProgress * 100)}%`;
  return (
    <div className={cx('sf-loader', className)} role="status" aria-live="polite">
      {label}
      <div className="sf-loader-bar" />
      <span className="sf-loader-text">{text}</span>
    </div>
  );
}
