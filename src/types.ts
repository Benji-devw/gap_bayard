/**
 * Contrat de données du template Villa — variante « Lagon » (location saisonnière, Bora-Bora).
 * Tout le contenu de la page vient de data/villa.json : modifiez ce fichier (ou demandez à une IA
 * de le faire, voir PROMPT.md) sans toucher au code.
 */

/** Point de piste d'une pièce : [t, x, y] — t = progression 0..1, x/y = position dans l'image 0..1 (depuis le coin haut-gauche) */
export type TrackPoint = [t: number, x: number, y: number];

/** Télémétrie du drone : [t, altitude en m, cap en degrés] */
export type TelemetryPoint = [t: number, altitude: number, heading: number];

export interface Link {
  label: string;
  href: string;
}

/**
 * Un candidat vidéo : le premier que l'écran et le navigateur acceptent est lu.
 * Ex. version portrait pour le téléphone tenu à la verticale, version HEVC pour Safari, AV1 pour Chrome.
 */
export interface VideoSourceSpec {
  src: string;
  /** Type MIME avec codecs, ex. 'video/mp4; codecs="hvc1.1.6.L120.B0"' : ignoré si le navigateur ne sait pas le lire */
  type?: string;
  /** Requête média que l'écran doit satisfaire, ex. "(orientation: portrait)" */
  media?: string;
  /**
   * Portion de l'image de référence (vidéo ordinateur) que contient cette vidéo, en fractions 0..1 depuis le coin
   * haut-gauche : les points, chapitres et zooms restent placés dans l'image complète.
   * Ex. recadrage 3:4 au centre d'une 16:9 : { "x": 0.289, "y": 0, "width": 0.422, "height": 1 }
   */
  crop?: { x: number; y: number; width: number; height: number };
  /** Nombre d'images de cette vidéo si sa cadence diffère (sinon count / countMobile) */
  count?: number;
}

/** Un fichier, ou une liste de candidats (vidéo seulement) */
export type MediaSource = string | VideoSourceSpec[];

/** Premier fichier d'une source (motif d'images, ou vidéo de référence pour l'analyse du mouvement) */
export function firstSource(source: MediaSource): string {
  return typeof source === 'string' ? source : (source[0]?.src ?? '');
}

/** Crédit d'une œuvre utilisée sur le site (vidéo, musique…) */
export interface Credit {
  label: string;
  author: string;
  authorHref?: string;
  linkLabel?: string;
  href?: string;
}

/** Pièce (ou espace extérieur) de la visite : un point numéroté dans la vidéo, une fiche en carte arrondie. */
export interface Hotspot {
  id: string;
  /** Nom court affiché à côté du point */
  label: string;
  /** Petite ligne au-dessus du titre (ex. « Rez-de-chaussée · 45 m² ») */
  category?: string;
  title: string;
  /** Légende manuscrite sous la photo */
  note?: string;
  description?: string;
  details?: { label: string; value: string }[];
  /** Équipements de la pièce (liste cochée) */
  features?: string[];
  /** Photo de la pièce ; sans photo, la fiche affiche un zoom en direct dans la vidéo */
  image?: string;
  link?: Link;
  /** Limite optionnelle de la plage d'affichage (progression 0..1) */
  in?: number;
  out?: number;
  /**
   * Mode simple : point fixe entre deux instants, à une position de l'image.
   * Ex. { "from": 0.62, "to": 0.7, "x": 0.3, "y": 0.6 }. Ignoré si `track` contient des points.
   */
  at?: { from: number; to: number; x: number; y: number };
  /** Mode suivi : positions au fil de la vidéo, triées par t (le point suit la pièce) */
  track?: TrackPoint[];
}

export type ChapterPosition = 'hero' | 'left' | 'right' | 'center' | 'bottom-left' | 'bottom-right';

export interface Chapter {
  in: number;
  out: number;
  position: ChapterPosition;
  kicker?: string;
  title: string;
  /** Ligne manuscrite sous le titre */
  note?: string;
  text?: string;
  meta?: string;
  cta?: Link;
  stats?: { value: number; decimals?: number; suffix?: string; label: string }[];
}

export interface VillaData {
  $schema?: string;
  meta: { title: string; description: string; lang?: string };
  theme: {
    colors: {
      bg: string;
      surface: string;
      fg: string;
      muted: string;
      line: string;
      accent: string;
      /** Seconde couleur d'accent (coches, tampons) */
      accent2: string;
      /** Couleur de rappel (ex. couleur du logo), en touches discrètes ; absente = accent2 */
      highlight?: string;
      ink: string;
    };
    /** hand : police manuscrite des annotations */
    fonts: { url?: string; display: string; body: string; hand: string };
  };
  brand: {
    name: string;
    location: string;
    /** Prix affiché (ex. « 650 € ») */
    price?: string;
    /** Précision du prix (ex. « la nuit, ménage inclus ») */
    priceNote?: string;
    /** Logo du client (image de public/) : remplace le nom dans l'en-tête, le chargement et le pied de page */
    logo?: string;
    cta: Link;
    nav: Link[];
  };
  media: {
    type: 'frames' | 'video';
    /**
     * frames : motif "frames/dossier/{index}.webp" — video : "videos/villa.mp4", ou adresse complète (vidéo sur Cloudflare R2),
     * ou liste de candidats (voir VideoSourceSpec : codecs, orientation, recadrage)
     */
    src: MediaSource;
    /** En local (npm run dev, npm run preview) : fichier de public/ lu à la place de `src` (vidéo trop lourde pour Git, en ligne sur R2) */
    srcLocal?: string;
    /** Version plus légère pour les écrans < 768 px (même durée ; même cadrage, ou recadrée : `crop` d'un candidat) */
    srcMobile?: MediaSource;
    /** Vidéo : nombre d'images de `srcMobile` quand elle a une autre cadence (30 images/s sur mobile, plus fluide) */
    countMobile?: number;
    count?: number;
    fit?: 'cover' | 'contain';
    focus?: string;
    /** Longueur de scroll en vh */
    length?: number;
    smooth?: number;
    /** Inertie sur écran tactile (défaut 0,25 : plus directe, le doigt a déjà la sienne) */
    smoothTouch?: number;
    /** Ralentis : dans ces plages de la vidéo, le scroll avance `factor` fois plus lentement (le temps de lire) */
    slowdowns?: { from: number; to: number; factor: number }[];
    /** Rythme : poids de scroll par tranche égale de vidéo (généré par « Analyser le mouvement » dans ?edit) */
    pace?: number[];
  };
  /** Musique d'ambiance de la visite (coupée par défaut, bouton en bas à droite) */
  audio?: {
    src: string;
    /** Volume sur ordinateur, 0..1 */
    volume?: number;
    /** Volume sur écran tactile (téléphone, tablette) ; absent = `volume`. Safari sur iPhone l'ignore (toujours à 100 %) */
    volumeMobile?: number;
  };
  /**
   * Bouton lecture (en bas au centre) : la visite défile toute seule. `duration` = durée de la visite entière, en secondes ;
   * `follow` = part du rythme du scroll suivie (0 = vidéo à vitesse régulière, 1 = comme au scroll ; 0,35 par défaut)
   */
  play?: {
    duration?: number;
    follow?: number;
    /** Bouton « visite en musique » en plus : lance ensemble la musique (depuis le début) et la visite (depuis le début) ; demande `audio` */
    withMusic?: boolean;
    /**
     * Visite en musique : décalage (s) pour caler les temps forts du morceau sur les images.
     * Positif : la visite part d'autant plus loin dans la vidéo ; négatif : la musique part d'autant plus loin dans le morceau.
     */
    musicOffset?: number;
  };
  /** Lieu du bien pour le bouton Google Maps de l'en-tête (adresse, ville ou code postal) */
  map?: { query: string };
  /** Précision propre au projet dans la popup « Comment ça marche », sous l'introduction (ex. vidéo d'un autre réalisateur) */
  studioNote?: string;
  /** Viseur « caméra drone » du début (REC, timecode, coins) : signature Navart, présente sur chaque projet */
  hud?: { enabled: boolean; until?: number; fps?: number; telemetry?: TelemetryPoint[] };
  hotspotSettings?: {
    /** Écart maximal (en progression) entre deux points pour considérer la pièce visible entre eux */
    gap?: number;
    /** Zoom du détail affiché dans la fiche sans photo (part de la hauteur de l'image) */
    zoom?: number;
  };
  chapters: Chapter[];
  /** Les pièces de la visite, dans l'ordre du parcours (le numéro du point suit cet ordre) */
  hotspots: Hotspot[];
  sections: {
    /** Avis (facultatif) : saisis dans items, ou vrais avis Google via `api` (voir api/reviews.js) */
    reviews?: {
      kicker?: string;
      title: string;
      note?: string;
      text?: string;
      /** true = avis d'exemple : mention visible, pas de lien Google */
      sample?: boolean;
      /** Adresse de la fonction serveur des avis Google, ex. "/api/reviews" ; vide = avis du JSON */
      api?: string;
      items: Review[];
    };
    stats: {
      kicker?: string;
      title: string;
      note?: string;
      /** Texte d'introduction à côté des chiffres */
      text?: string;
      /** Grande photo d'ouverture de la section (chemin dans public/) et sa légende */
      image?: string;
      imageCaption?: string;
      items: { value: string; label: string }[];
    };
    /** Carte de score du parcours (golf) : un trou par entrée, dans l'ordre ; plans facultatifs */
    holes?: {
      kicker?: string;
      title: string;
      note?: string;
      text?: string;
      items: { number: number; par: number; hcp?: number; image?: string }[];
    };
    /** Récits en photo + texte, en alternance (séjourner, restaurant, séminaires, hiver…) */
    stories?: {
      kicker?: string;
      title: string;
      text?: string;
      items: {
        kicker?: string;
        title: string;
        text: string;
        image: string;
        imageAlt?: string;
        facts?: { label: string; value: string }[];
        link?: Link;
      }[];
    };
    rooms: { kicker?: string; title: string; text?: string };
    amenities: { kicker?: string; title: string; note?: string; items: { icon: string; label: string; text?: string }[] };
    gallery: { kicker?: string; title: string; items: { src: string; caption: string }[] };
    rules: { kicker?: string; title: string; items: { label: string; value: string }[] };
    /** Tarifs en tableau façon carte de score (golf) : colonnes (saisons), lignes, puis tarifs annexes par groupe */
    rates?: {
      kicker?: string;
      title: string;
      note?: string;
      text?: string;
      columns: { label: string; period?: string }[];
      /** Une valeur par colonne */
      rows: { label: string; values: string[] }[];
      extras?: { title: string; items: { label: string; value: string }[] }[];
      /** Origine des tarifs (ex. « Grille officielle 2026, TTC ») */
      source?: string;
      link?: Link;
    };
    contact: {
      kicker?: string;
      title: string;
      text?: string;
      host: { name: string; role: string; phone: string; email: string; note?: string };
      /** Nombre maximal de voyageurs (champ du formulaire) */
      maxGuests?: number;
      /** URL d'envoi du formulaire (Formspree, Netlify Forms, API…) ; vide = mode démo */
      formAction?: string;
      /** Réservation en ligne (ex. départs sur prima.golf) : bouton principal, ouvert dans un nouvel onglet */
      booking?: Link;
      bookingNote?: string;
      /** true = une seule date dans le formulaire (date souhaitée, sans départ) : golf, cours, rendez-vous */
      singleDate?: boolean;
      submitLabel: string;
      successMessage: string;
      /** Calendrier des disponibilités au-dessus du formulaire (facultatif) */
      availability?: {
        title: string;
        /** true = réservations d'exemple générées (démo) et mention visible */
        sample?: boolean;
        /** Adresse de la fonction qui lit le calendrier iCal du bien, ex. "/api/availability" ; vide = dates du JSON */
        api?: string;
        /** Séjour minimum, en nuits */
        minNights?: number;
        /** Réservations saisies à la main : `to` = jour du départ (nuit non comprise), dates AAAA-MM-JJ */
        booked?: { from: string; to: string }[];
      };
    };
  };
  footer: {
    text: string;
    links: Link[];
    /** Crédits des œuvres utilisées (vidéo d'un autre réalisateur, musique…) */
    credits?: Credit[];
  };
  /** Petits textes de l'interface (facultatifs : valeurs françaises par défaut, voir UI_DEFAULTS) */
  ui?: Partial<Omit<UiText, 'form'>> & { form?: Partial<UiText['form']> };
}

/** Un avis (JSON, ou renvoyé par la fonction api/reviews.js) */
export interface Review {
  name: string;
  /** Ville ou pays */
  origin?: string;
  date: string;
  /** 1 à 5 */
  rating: number;
  text: string;
  /** Avis Google : photo et profil de l'auteur */
  photo?: string | null;
  profile?: string | null;
}

export interface UiText {
  /** Tutoriel du début de la visite, selon l'appareil : tactile, pavé tactile, souris */
  tutorialTouch: string;
  tutorialTrackpad: string;
  tutorialWheel: string;
  /** Invitation à tourner le téléphone (téléphone tenu à la verticale, pendant l'accueil) */
  rotateHint: string;
  /** Bouton Google Maps de l'en-tête */
  map: string;
  /** Section avis : nombre ({count}), étoiles ({rating}), mention d'exemple, lien et attribution Google */
  reviewsCount: string;
  reviewsRating: string;
  reviewsSample: string;
  reviewsLink: string;
  reviewsGoogle: string;
  /** Flèches du carrousel d'avis */
  reviewsPrev: string;
  reviewsNext: string;
  /** Calendrier des disponibilités */
  calendarPrev: string;
  calendarNext: string;
  calendarFree: string;
  calendarBooked: string;
  calendarStay: string;
  calendarStart: string;
  calendarEnd: string;
  calendarSummary: string;
  calendarClear: string;
  calendarSample: string;
  /** Texte sous le nom pendant le chargement */
  loading: string;
  /** Tableau des tarifs : en-tête de la première colonne */
  ratesItem: string;
  /** Carte de score des trous : intitulés des lignes et des totaux */
  holesHole: string;
  holesPar: string;
  holesHcp: string;
  holesOut: string;
  holesIn: string;
  holesTotal: string;
  /** Plan d'un trou : légende ({n} numéro, {par}) */
  holesPlan: string;
  /** Lien des cartes de la section « lieux » */
  seeInTour: string;
  /** Libellé d'accessibilité des points : "<nom> : <details>" */
  details: string;
  close: string;
  /** Libellé d'accessibilité du bouton menu (mobile) */
  menu: string;
  /** Titre de l'itinéraire affiché pendant la visite */
  route: string;
  /** Pastille du zoom en direct (pièce sans photo) */
  live: string;
  /** Format affiché dans le viseur drone ({fps} = images par seconde) */
  hudFormat: string;
  /** Bouton plein écran de la visite */
  fullscreen: string;
  exitFullscreen: string;
  /** Bulle au-dessus du bouton plein écran quand le téléphone passe à l'horizontale */
  fullscreenHint: string;
  /** Bouton de la musique d'ambiance */
  soundOn: string;
  soundOff: string;
  /** Bouton de lecture automatique de la visite */
  play: string;
  pause: string;
  /** Bouton « visite en musique » (musique et lecture automatique ensemble) : texte visible, suivi d'une note de musique */
  playWithMusicText: string;
  /** Libellés complets du même bouton (lecteurs d'écran, infobulle) */
  playWithMusic: string;
  pauseWithMusic: string;
  /** Voile pendant un saut d'un lieu à un autre (« En route vers » + nom du lieu) */
  travel: string;
  /** Plein écran pendant la visite : bouton qui rappelle ou range l'en-tête */
  showHeader: string;
  hideHeader: string;
  form: { arrival: string; departure: string; guests: string; name: string; email: string; message: string };
}

export const UI_DEFAULTS: UiText = {
  tutorialTouch: 'Glissez vers le haut pour visiter',
  tutorialTrackpad: 'Deux doigts vers le haut pour visiter',
  tutorialWheel: 'Molette vers le bas pour visiter',
  rotateHint: 'Tournez votre téléphone pour une visite plein écran',
  map: 'Voir sur Google Maps',
  reviewsCount: '{count} avis',
  reviewsRating: '{rating} sur 5',
  reviewsSample: "Avis d'exemple, à remplacer par les vrais avis du bien",
  reviewsLink: 'Voir les avis sur Google',
  reviewsGoogle: 'Avis Google',
  reviewsPrev: 'Avis précédents',
  reviewsNext: 'Avis suivants',
  calendarPrev: 'Mois précédent',
  calendarNext: 'Mois suivant',
  calendarFree: 'Disponible',
  calendarBooked: 'Réservé',
  calendarStay: 'Votre séjour',
  calendarStart: "Choisissez votre date d'arrivée",
  calendarEnd: 'Puis votre date de départ ({n} nuits minimum)',
  calendarSummary: '{n} nuits, du {from} au {to}',
  calendarClear: 'Effacer',
  calendarSample: "Disponibilités d'exemple, à relier au vrai calendrier du bien",
  loading: 'on prépare votre visite…',
  ratesItem: 'Formule',
  holesHole: 'Trou',
  holesPar: 'Par',
  holesHcp: 'Hcp',
  holesOut: 'Aller',
  holesIn: 'Retour',
  holesTotal: 'Total',
  holesPlan: 'Trou {n} · par {par}',
  seeInTour: 'Voir dans la visite →',
  details: 'voir la pièce',
  close: 'Fermer',
  menu: 'Menu',
  route: 'Itinéraire',
  live: 'Dans la visite',
  hudFormat: '4K · {fps} IPS',
  fullscreen: 'Plein écran',
  exitFullscreen: 'Quitter le plein écran',
  fullscreenHint: 'Touchez pour passer en plein écran',
  soundOn: 'Activer le son',
  soundOff: 'Couper le son',
  play: 'Lire la visite',
  pause: 'Mettre la visite en pause',
  playWithMusicText: 'Visite en',
  playWithMusic: 'Lancer la visite en musique synchronisée',
  pauseWithMusic: 'Arrêter la musique synchronisée',
  travel: 'En route vers',
  showHeader: 'Afficher le menu',
  hideHeader: 'Masquer le menu',
  form: {
    arrival: 'Arrivée',
    departure: 'Départ',
    guests: 'Voyageurs',
    name: 'Nom',
    email: 'E-mail',
    message: 'Message',
  },
};

export function resolveUi(ui: VillaData['ui']): UiText {
  return { ...UI_DEFAULTS, ...ui, form: { ...UI_DEFAULTS.form, ...ui?.form } };
}

/**
 * Vérifications légères au chargement (en développement) : un JSON modifié à la main ou par une IA
 * qui casse la page produit un message clair dans la console plutôt qu'un écran blanc.
 */
export function validateVilla(data: VillaData): string[] {
  const issues: string[] = [];
  const need = (cond: unknown, msg: string) => {
    if (!cond) issues.push(msg);
  };
  need(data.media?.src && firstSource(data.media.src), 'media.src est obligatoire');
  need(data.media?.type === 'frames' || data.media?.type === 'video', 'media.type doit valoir "frames" ou "video"');
  if (data.media?.type === 'frames') {
    need(data.media.count && data.media.count > 1, 'media.count est obligatoire en mode "frames"');
    need(typeof data.media.src === 'string', 'media.src doit être un motif de fichiers (texte) en mode "frames"');
  }
  const sources = [data.media?.src, data.media?.srcMobile].filter((s): s is VideoSourceSpec[] => Array.isArray(s));
  sources.forEach((list, k) => {
    const where = k === 0 ? 'media.src' : 'media.srcMobile';
    need(list.length > 0, `${where} : la liste de vidéos est vide`);
    list.forEach((s, i) => {
      need(s && typeof s.src === 'string' && s.src, `${where}[${i}] : src manquant`);
      if (s?.crop) {
        const c = s.crop;
        const ok = [c.x, c.y, c.width, c.height].every((n) => typeof n === 'number' && n >= 0 && n <= 1) && c.width > 0 && c.height > 0;
        need(ok, `${where}[${i}].crop : attendu { x, y, width, height } entre 0 et 1`);
      }
    });
  });
  need(data.theme?.fonts?.hand, 'theme.fonts.hand (police manuscrite) est obligatoire');
  const ids = new Set<string>();
  data.hotspots?.forEach((h, i) => {
    const where = `hotspots[${i}] (${h.id ?? '?'})`;
    need(h.id, `${where} : id manquant`);
    need(!ids.has(h.id), `${where} : id en double`);
    ids.add(h.id);
    need(h.label && h.title, `${where} : label et title sont obligatoires`);
    need(h.at || (Array.isArray(h.track) && h.track.length > 1), `${where} : renseignez "at" (mode simple) ou "track" (au moins 2 points)`);
    if (h.at) need(h.at.from < h.at.to, `${where}.at : from doit être inférieur à to`);
    h.track?.forEach((p, j) => {
      const ok = Array.isArray(p) && p.length === 3 && p.every((n) => typeof n === 'number' && n >= -0.5 && n <= 1.5);
      need(ok, `${where}.track[${j}] : attendu [t, x, y] avec des nombres entre 0 et 1`);
      if (j > 0 && ok && h.track?.[j - 1]) need(p[0] >= h.track[j - 1][0], `${where}.track[${j}] : les points doivent être triés par t`);
    });
  });
  data.chapters?.forEach((c, i) => need(c.in < c.out, `chapters[${i}] : in doit être inférieur à out`));
  return issues;
}
