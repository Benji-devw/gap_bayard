interface MapButtonProps {
  /** Lieu cherché dans Google Maps (clé `map.query` du JSON) */
  query: string;
  label: string;
  /** Classe de l'icône (barre verticale d'Estate : vl-rail-icon) */
  iconClassName?: string;
  /** Si fournie, le libellé est aussi affiché, dans un span de cette classe */
  labelClassName?: string;
}

/** Lien Google Maps vers le lieu du bien, dans l'en-tête. */
export function MapButton({ query, label, iconClassName, labelClassName }: MapButtonProps) {
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return (
    <a className="vl-map" href={href} target="_blank" rel="noopener" aria-label={label} title={label}>
      <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z" />
        <circle cx="12" cy="10" r="2.4" />
      </svg>
      {labelClassName && <span className={labelClassName}>{label}</span>}
    </a>
  );
}
