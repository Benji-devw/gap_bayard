import { useEffect } from 'react';

/**
 * Apparition des blocs des sections qui suivent la visite, une seule fois, quand ils arrivent à l'écran.
 * Le hook pose `data-reveal` sur les blocs (masqués par villa.css), puis `data-revealed` à leur entrée, avec un
 * léger décalage (`--reveal-delay`) entre les blocs qui entrent ensemble. Pas de calcul à chaque image :
 * IntersectionObserver prévient, puis le bloc n'est plus surveillé.
 * Sans IntersectionObserver ou avec `prefers-reduced-motion`, rien n'est masqué.
 */
export function useReveal(selectors: readonly string[]) {
  const key = selectors.join(',');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const targets = Array.from(document.querySelectorAll<HTMLElement>(key)).filter(
      (el) => !el.hasAttribute('data-revealed'),
    );
    const io = new IntersectionObserver(
      (entries) => {
        const entering = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          // ordre du document : le décalage suit l'ordre de lecture
          .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
        entering.forEach((el, k) => {
          el.style.setProperty('--reveal-delay', `${Math.min(k, 6) * 80}ms`);
          el.setAttribute('data-revealed', '');
          io.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0 },
    );
    targets.forEach((el) => {
      el.setAttribute('data-reveal', '');
      io.observe(el);
    });
    return () => {
      io.disconnect();
      // bloc pas encore apparu : on le rend visible (sinon il resterait masqué, ex. double montage en développement)
      targets.forEach((el) => {
        if (!el.hasAttribute('data-revealed')) el.removeAttribute('data-reveal');
      });
    };
  }, [key]);
}
