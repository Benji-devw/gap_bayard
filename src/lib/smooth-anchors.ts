import { useEffect, useRef } from 'react';

/**
 * Prend en charge un lien interne à la place du défilement lisse (ex. voile au lieu de traverser la visite).
 * Retourne true si le lien est traité.
 */
export type AnchorIntercept = (target: HTMLElement, link: Element) => boolean;

/**
 * Défilement lisse vers les ancres de la page (href="#section") : navigation de l'en-tête, menu mobile,
 * logo, boutons des chapitres et des fiches. Instantané si le visiteur a demandé moins d'animations.
 * Le défilement part à l'image suivante, une fois le menu mobile refermé (il bloque le défilement de la page).
 * `intercept` peut prendre la main sur un lien (voir AnchorIntercept).
 */
export function useSmoothAnchors(intercept?: AnchorIntercept) {
  const interceptRef = useRef(intercept);
  useEffect(() => {
    interceptRef.current = intercept;
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href^="#"]');
      const id = link ? decodeURIComponent(link.getAttribute('href')!.slice(1)) : '';
      const target = id ? document.getElementById(id) : null;
      if (!link || !target) return;
      e.preventDefault();
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => {
        if (!interceptRef.current?.(target, link)) {
          target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        }
        history.pushState(null, '', `#${id}`);
      });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
}
