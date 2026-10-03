import { createElement, useLayoutEffect, useMemo, useRef, type CSSProperties, type HTMLAttributes } from 'react';
import { StepContext, useSequence } from './context';
import { cx } from './cx';

export type StepAnim =
  | 'fade'
  | 'fade-up'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'scale'
  | 'zoom'
  | 'blur'
  | 'clip'
  | 'drift'
  | 'none';

type StepTag = 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'p' | 'h1' | 'h2' | 'h3' | 'span' | 'ul' | 'figure';

export interface StepProps extends HTMLAttributes<HTMLElement> {
  /** Progression (0..1) à laquelle le bloc apparaît */
  in?: number;
  /** Progression (0..1) à laquelle il a disparu */
  out?: number;
  /** Durée du fondu, en fraction de la séquence (défaut : 0.06 max) */
  fade?: number;
  /** Preset d'animation (voir scroll-frames.css) */
  anim?: StepAnim;
  /** Amplitude du mouvement, nombre = px */
  distance?: number | string;
  as?: StepTag;
}

/**
 * Bloc de contenu visible entre `in` et `out`.
 * Le moteur écrit --sf-p / --sf-v / --sf-e sur l'élément : animez-le en CSS comme vous voulez.
 */
export function Step({
  in: start = 0,
  out: end = 1,
  fade,
  anim = 'fade-up',
  distance,
  as = 'div',
  className,
  style,
  children,
  ...rest
}: StepProps) {
  const ref = useRef<HTMLElement>(null);
  const engine = useSequence();

  useLayoutEffect(() => {
    if (!engine || !ref.current) return;
    return engine.addStep(ref.current, { in: start, out: end, fade });
  }, [engine, start, end, fade]);

  const range = useMemo(() => ({ in: start, out: end }), [start, end]);
  const stepStyle =
    distance === undefined
      ? style
      : ({ ...style, '--sf-distance': typeof distance === 'number' ? `${distance}px` : distance } as CSSProperties);

  return (
    <StepContext.Provider value={range}>
      {createElement(
        as,
        {
          ...rest,
          ref,
          className: cx('sf-step', className),
          'data-anim': anim === 'none' ? undefined : anim,
          style: stepStyle,
        },
        children,
      )}
    </StepContext.Provider>
  );
}
