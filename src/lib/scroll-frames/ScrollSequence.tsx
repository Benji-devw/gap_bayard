import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import { ScrollFramesEngine, type EngineEvents, type ScrollFramesOptions } from './engine';
import { SequenceContext } from './context';
import { SequenceLoader } from './extras';
import { cx } from './cx';

export interface ScrollSequenceProps extends ScrollFramesOptions {
  /** Longueur de scroll : nombre = vh (défaut 400), ou toute valeur CSS ("3000px") */
  length?: number | string;
  id?: string;
  className?: string;
  /** Classe du calque de contenu posé sur le canvas (idéal pour une grille de placement) */
  layerClassName?: string;
  style?: CSSProperties;
  /** Rendu derrière le canvas (fonds, grands titres visibles à travers une séquence transparente) */
  behind?: ReactNode;
  /** Rendu au-dessus du calque (HUD, barre de progression, navigation de chapitres…) */
  overlay?: ReactNode;
  /** Écran de chargement personnalisé, ou false pour aucun */
  loader?: ReactNode | false;
  children?: ReactNode;
  onProgress?: (detail: EngineEvents['progress']) => void;
  onReady?: () => void;
  /** Accès direct au moteur (scrollTo, on, …) */
  engineRef?: Ref<ScrollFramesEngine | null>;
}

export function ScrollSequence({
  length = 400,
  id,
  className,
  layerClassName,
  style,
  behind,
  overlay,
  loader,
  children,
  onProgress,
  onReady,
  engineRef,
  ...options
}: ScrollSequenceProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<ScrollFramesEngine | null>(null);

  const optionsKey = JSON.stringify(options);
  const latest = useRef({ options, onProgress, onReady });
  useLayoutEffect(() => {
    latest.current = { options, onProgress, onReady };
  });

  useLayoutEffect(() => {
    const e = new ScrollFramesEngine(sectionRef.current!, stickyRef.current!, canvasRef.current!, latest.current.options);
    setEngine(e);
    return () => {
      e.destroy();
      setEngine(null);
    };
  }, []);

  useEffect(() => {
    engine?.setOptions(latest.current.options);
  }, [engine, optionsKey]);

  useEffect(() => {
    if (!engine) return;
    const offs = [
      engine.on('progress', (d) => latest.current.onProgress?.(d)),
      engine.on('ready', () => latest.current.onReady?.()),
    ];
    return () => offs.forEach((off) => off());
  }, [engine]);

  useImperativeHandle<ScrollFramesEngine | null, ScrollFramesEngine | null>(engineRef, () => engine, [engine]);

  const sectionStyle = {
    ...style,
    '--sf-length': typeof length === 'number' ? `${length}vh` : length,
  } as CSSProperties;

  return (
    <SequenceContext.Provider value={engine}>
      <section ref={sectionRef} id={id} className={cx('sf', className)} style={sectionStyle}>
        <div ref={stickyRef} className="sf-sticky">
          {behind}
          <canvas ref={canvasRef} className="sf-canvas" aria-hidden="true" />
          <div className={cx('sf-layer', layerClassName)}>{children}</div>
          {overlay}
          {loader === false ? null : (loader ?? <SequenceLoader />)}
        </div>
      </section>
    </SequenceContext.Provider>
  );
}
