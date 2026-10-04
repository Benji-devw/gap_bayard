# Golf de Gap-Bayard — 18 trous de montagne, « visite au scroll »

Prototype de prospection pour le Golf de Gap-Bayard (Centre d'oxygénation, plateau de Bayard, Hautes-Alpes), sur la base du projet de référence `bora_sotheby` : la vidéo du survol se joue au rythme du scroll ; sept lieux numérotés (échauffement, practice, parcours, greens, fairways, bunkers, club-house) ouvrent une fiche ; tarifs 2026 en tableau, réservation des départs sur prima.golf. Tout le contenu (textes, couleurs, vidéo, lieux, sections) est dans **un seul fichier JSON**.

**Vidéo provisoire** : survol d'un autre parcours (Fly Over Green, filigrane visible), pour montrer l'interface seulement. À remplacer par le tournage FPV de Gap-Bayard avant toute mise en ligne publique ; chapitres, points et ralentis seront alors à recaler dans `?edit`.

Direction artistique « Carte de score », version fine : vert sapin profond et laiton sur crème, magenta du logo en touches discrètes (`theme.colors.highlight`) ; logo recoloré magenta et sapin ; Instrument Serif + Geist + Geist Mono ; filets d'un pixel, boutons en pilule. Carte de score des 18 trous et plans des trous, récits photo (hébergement, restaurant, Golf Academy, séminaires, hiver), green fees en tableau. Photos et plans repris du site gap-bayard.com. Détail en tête de `villa.css`.

React 19 + TypeScript + Vite. Aucune bibliothèque d'animation, aucun re-render React pendant le scroll.

Démo en ligne : [gap-bayard.vercel.app](https://gap-bayard.vercel.app) (dépôt privé [Benji-devw/gap_bayard](https://github.com/Benji-devw/gap_bayard)). **Préproduction privée, non indexée** : balise `robots` de `index.html` et en-tête `X-Robots-Tag` de `vercel.json` (toutes les adresses), les deux à retirer à la mise en ligne ; pas de `robots.txt` « Disallow », qui empêcherait les moteurs de lire la consigne.

---

## Points forts

- **Visite vidéo pilotée par le scroll** : lissage, rythme calé sur le mouvement de la caméra, ralentis dans chaque pièce
- **Les pièces dans la vidéo** : points numérotés dans l'ordre du parcours, fiche en carte arrondie, itinéraire de la visite (écrans larges), section « pièces » qui ramène au bon moment de la visite
- **Tout dans `src/data/villa.json`**, avec schéma JSON (autocomplétion et vérification dans VS Code)
- **Éditeur visuel** (`?edit`) : placez les pièces à la souris, calculez le rythme du scroll, exportez le JSON
- **Modifiable avec une IA en un prompt** : voir `PROMPT.md`
- **Viseur drone** au début de la visite (signature Navart), **musique d'ambiance** (coupée par défaut, fondus, téléchargée au premier clic, uniquement pendant la visite) **bouton lecture** (la visite défile toute seule ; pause au clic, au scroll ou à l'ouverture d'une fiche) et **bouton plein écran** en bas au centre
- **Itinéraire en capsule de verre** bleu lagon le long du bord droit : anneau blanc à venir, point turquoise vu, pastille corail numérotée pour le lieu en cours, fil qui se remplit de turquoise, nom au survol ; masqué sur téléphone
- **Mobile** : vidéo moitié moins lourde en même définition, gardée en portrait comme en paysage ; fiche en panneau bas, menu burger et visite compacte à l'horizontale, invitation à tourner le téléphone
- Sections la villa en bref (avec prix à la nuit), pièces, équipements, galerie, bon à savoir, réservation (formulaire dates + voyageurs), pied de page
- Accessibilité : `prefers-reduced-motion` respecté, navigation clavier, Échap ferme la fiche

## Démarrage

Prérequis : Node.js 20.19+ ou 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173  (éditeur : http://localhost:5173/?edit)
npm run build      # site statique dans dist/
npm run preview    # prévisualise le build
```

## Structure

```
src/data/villa.json          tout le contenu : textes, couleurs, vidéo, pièces, sections
src/data/villa.schema.json   structure du JSON (autocomplétion dans VS Code)
src/VillaPage.tsx            la page
src/villa.css                le design (couleurs et polices viennent du JSON)
src/components/              points et fiches des pièces, itinéraire, éditeur, formulaire de réservation, icônes
src/types.ts                 types TypeScript du JSON et vérifications
src/utils.ts                 calcul des positions des points
src/lib/scroll-frames/       le moteur de scroll (réutilisable dans d'autres projets)
public/media/visite-local.mp4   vidéo ordinateur (2K 2560×1440, cadence variable mpdecimate, 3054 images, image clé toutes les 12, crf 25, 196 Mo), exclue de Git ; en ligne : R2 landing-studio/gap_bayard/gap_bayard_v2.mp4
public/media/visite-mobile.mp4   version mobile (mêmes 3054 images en 1920×1080, même mpdecimate, débruitée, crf 30)
public/media/lieux/          images de la vidéo pour les fiches des lieux (section « dans la visite »)
public/media/photos/         photos du golf et du domaine nordique (site gap-bayard.com) : sections, récits, galerie
public/media/trous/          plans des 18 trous (site gap-bayard.com), carte de score
public/media/galerie/        photos de la galerie
PROMPT.md                    prompts prêts à l'emploi pour tout modifier avec une IA
```

---

## Personnaliser

### Avec une IA

Ouvrez `PROMPT.md` : copiez le prompt, joignez `src/data/villa.json`, décrivez vos changements (bien, textes, couleurs, pièces, langue…), et remplacez le fichier par la réponse.

### À la main : `src/data/villa.json`

| Clé | Contenu |
| --- | --- |
| `meta` | titre et description de la page (référencement), langue |
| `theme` | couleurs (`bg`, `surface`, `fg`, `muted`, `line`, `accent`, `accent2`, `ink`) et polices Google Fonts (`display`, `body`, `hand` manuscrite) |
| `brand` | nom du bien, lieu, prix à la nuit et sa précision, menu, bouton d'en-tête |
| `media` | vidéo, longueur de scroll, lissage, ralentis, rythme |
| `map` | lieu du bien (`query` : adresse, ville ou code postal) : bouton Google Maps dans l'en-tête |
| `audio` | musique d'ambiance de la visite (`src`, `volume`) : coupée par défaut, bouton en bas au centre |
| `play` | bouton lecture en bas au centre (vidéo lue nativement à vitesse variable, la page suit) ; `duration` = durée de la visite entière en secondes (par défaut `media.count` ÷ `hud.fps`) ; `follow` = part du rythme du scroll suivie (0 = vidéo à vitesse régulière, 1 = comme au scroll, 0,35 par défaut) ; absent = pas de bouton |
| `hud` | viseur « caméra drone » du début (REC, timecode, coins) : signature Navart, s'efface à `until` |
| `chapters` | textes qui apparaissent pendant la visite (`note` : ligne manuscrite) |
| `hotspots` | les pièces, dans l'ordre du parcours : nom, légende, description, détails, équipements, photo, positions |
| `sections` | la villa en bref, pièces, équipements, galerie, bon à savoir, réservation |
| `sections.reviews` | avis : saisis dans `items` (exemples fictifs par défaut, `sample: true`) ou vrais avis Google via `api` (voir « Avis » plus bas) |
| `sections.contact.availability` | calendrier des disponibilités : exemple (`sample`), dates à la main (`booked`) ou calendrier iCal réel (`api`) ; voir « Disponibilités » plus bas |
| `footer` | texte, liens et crédits (`credits` : vidéo, musique…) du pied de page |
| `ui` | petits textes de l'interface (indication de scroll, libellés du formulaire…) |

**Le temps de la visite va de 0 à 1** : `0` = début de la vidéo, `1` = fin, `0.5` = milieu. Pour une vidéo de 132 s, l'instant 33 s vaut `33 / 132 = 0.25`. C'est l'unité de `in`, `out`, `from`, `to` et du premier nombre de chaque point de `track`.

Les chemins d'images et de vidéos sont relatifs au dossier `public/` (ex. `"media/pieces/salon.webp"`).

En développement, les erreurs du JSON (clé manquante, id en double, point mal trié…) s'affichent dans la console du navigateur.

#### Chapitres (`chapters`)

```json
{ "in": 0.1, "out": 0.17, "position": "left", "kicker": "01 — Le domaine", "title": "Entre pinède et Méditerranée", "text": "…" }
```

- `position` : `hero` (accueil), `left`, `right`, `center`, `bottom-left`, `bottom-right`
- `stats` (facultatif) : compteurs animés `[{ "value": 220, "suffix": " m²", "label": "habitables" }]`
- `cta` (facultatif) : bouton `{ "label": "…", "href": "#reserver" }`, `meta` : ligne en petites capitales

#### Pièces (`hotspots`)

```json
{
  "id": "salon",
  "label": "Le salon",
  "category": "Rez-de-chaussée · double hauteur",
  "title": "Le salon",
  "note": "7 mètres sous plafond",
  "description": "…",
  "details": [{ "label": "Places", "value": "8" }],
  "features": ["Télévision grand écran", "Climatisation"],
  "image": "media/pieces/salon.webp",
  "at": { "from": 0.2383, "to": 0.3029, "x": 0.55, "y": 0.64 }
}
```

L'ordre du tableau est l'ordre du parcours : il donne le numéro du point, de l'itinéraire et de la carte.

Deux façons de placer une pièce dans la vidéo :

- **Simple** : `"at": { "from": 0.62, "to": 0.7, "x": 0.3, "y": 0.6 }` : le point reste à la même place entre deux instants. `x` et `y` vont de 0 à 1 depuis le coin haut-gauche de l'image (0.5, 0.5 = centre).
- **Suivi** : `"track": [[t, x, y], …]` : le point suit un élément de la pièce quand la caméra bouge. Le plus simple est de le créer avec l'éditeur (voir plus bas).

Sans `image`, la fiche affiche un zoom en direct dans la vidéo. Les photos des pièces sont des images tirées de la vidéo (`public/media/pieces/`).

`hotspotSettings.gap` : écart maximal entre deux points de `track` pour que la pièce reste affichée entre eux. `hotspotSettings.zoom` : cadrage du zoom en direct.

#### Formulaire de réservation

`sections.contact.formAction` reçoit l'adresse d'envoi : [Formspree](https://formspree.io) (`https://formspree.io/f/xxxxxxx`), Netlify Forms, ou votre propre API (envoi `POST` des champs `arrival`, `departure`, `guests`, `name`, `email`, `message`). `sections.contact.maxGuests` limite le nombre de voyageurs. Laissé vide, le formulaire fonctionne en mode démo et n'envoie rien.

---

### Avis (`sections.reviews`)

Section facultative, avant la demande de visite / réservation. Deux sources :

- **Avis saisis dans le JSON** (`items` : `name`, `origin`, `date`, `rating` de 1 à 5, `text`). Les avis livrés sont des **exemples fictifs** : `sample: true` affiche la mention « Avis d'exemple » et masque le lien Google. **Avant la mise en ligne**, remplacez-les par les vrais avis du bien et passez `sample` à `false`, ou supprimez la section. Ne publiez jamais d'avis inventés : c'est une pratique commerciale trompeuse.
- **Vrais avis Google** (`api: "/api/reviews"`) : la fonction `api/reviews.js` interroge l'API Google Places côté serveur et renvoie la note, le nombre d'avis et jusqu'à 5 avis choisis par Google. Le site affiche alors « Avis Google », la photo et le lien du profil de chaque auteur, et le lien vers la fiche. Sans réponse de l'API (ou en `npm run dev`), les avis du JSON restent affichés.

Mise en place de l'API (Vercel) :

1. Google Cloud : créer une clé, activer **Places API (New)**, restreindre la clé à cette API.
2. Trouver le **Place ID** du lieu (outil « Place ID Finder » de Google).
3. Vercel → Settings → Environment Variables : `GOOGLE_MAPS_API_KEY` et `GOOGLE_PLACE_ID`.
4. `villa.json` : `"api": "/api/reviews"`, puis redéployer. Tester : `https://votre-site/api/reviews`.

Netlify ou Cloudflare Pages : même code, à placer dans `netlify/functions/` ou `functions/api/` (adapter la signature, voir l'en-tête du fichier).

### Disponibilités (`sections.contact.availability`)

Calendrier au-dessus du formulaire de réservation : un mois à la fois (12 mois), nuits libres ou réservées, choix de l'arrivée puis du départ (séjour minimum `minNights`, aucune nuit réservée entre les deux). Le séjour choisi remplit les dates du formulaire. Trois sources :

- **Exemple** (`sample: true`) : réservations fictives générées à partir de la date du jour (la démo ne se périme pas), mention « Disponibilités d'exemple ». À passer à `false` avec de vraies données.
- **À la main** : `booked: [{ "from": "2026-12-20", "to": "2026-12-27" }]` (`to` = jour du départ, nuit non comprise).
- **Calendrier réel** (`api: "/api/availability"`) : la fonction `api/availability.js` lit le calendrier iCal du bien et renvoie les nuits réservées. Variable d'environnement `ICAL_URL` (plusieurs adresses séparées par des virgules) :
  - Google Agenda : Paramètres de l'agenda › « Adresse secrète au format iCal » ;
  - Airbnb : Calendrier › Disponibilités › « Exporter le calendrier » ;
  - Booking.com : Calendrier › « Synchroniser les calendriers » › exporter.

  L'adresse iCal est privée : elle reste côté serveur. Sans réponse de la fonction (ou en `npm run dev`), les dates du JSON restent affichées.

## Changer la vidéo

### 1. Préparer la vidéo

Une vidéo lue au scroll doit avoir **une image clé toutes les 12 images** (sinon le défilement saccade) et pas de son. Deux fichiers aux **mêmes images** : même source, même cadence (30 images/s : le moteur n'affiche jamais plus de 25 à 40 images uniques par seconde), même début et même fin. Sans `-ss` ni `-frames:v`, chaque commande prend la source entière ; pour couper, mettre les **mêmes** `-ss DEBUT` et `-frames:v IMAGES` (durée × 30) sur les deux (un `-frames:v` seul fixe un nombre d'images, pas une durée : à deux cadences différentes, les fichiers ne s'arrêtent pas au même instant). Source de démonstration : 3840×2160 à 60 images/s, 2 min 02, SDR BT.709, montage déjà fait. Ordinateur (2K) : `ffmpeg -i source.mp4 -map 0:v:0 -an -vf "mpdecimate,scale=2560:-2:flags=lanczos" -fps_mode vfr -c:v libx264 -preset veryslow -crf 25 -profile:v high -level 5.1 -g 12 -keyint_min 12 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart public/media/visite-local.mp4` (3054 images, 196 Mo). Mobile, mêmes images : `-vf "mpdecimate,scale=1920:-2:flags=lanczos,hqdn3d=1.5:1.5:4:4" -fps_mode vfr`, `-crf 30 -g 12`. Ne pas revenir à la 4K à image clé toutes les 30 images : le scroll saccadait en plein écran dans Chrome sous Windows (décodage de jusqu'à 30 images 4K par position). Avec [ffmpeg](https://ffmpeg.org) :

```bash
# ordinateur : toute la source, 1080p, 30 i/s, qualité constante (crf), image clé toutes les 12 images
ffmpeg -i source.mp4 -map 0:v:0 -an -vf "fps=30,scale=1920:-2" -c:v libx264 -preset veryslow -crf 24 -profile:v high -level 4.2 -g 12 -keyint_min 12 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart public/media/visite-local.mp4

# mobile : mêmes images, compression plus forte (crf 32), toujours sans plafond de débit
ffmpeg -i source.mp4 -map 0:v:0 -an -vf "fps=30,scale=1920:-2" -c:v libx264 -preset veryslow -crf 32 -profile:v high -level 4.2 -g 12 -keyint_min 12 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart public/media/visite-mobile.mp4

# vérification : même nombre d'images sur les deux (devient media.count)
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 public/media/visite-local.mp4
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 public/media/visite-mobile.mp4
```

Hébergement : l'ordinateur sur Cloudflare R2 (`gap_bayard/`), copie locale `public/media/visite-local.mp4` pour le dev (exclue de Git). Le mobile va dans le dépôt s'il pèse moins de 100 Mo (limite GitHub), sinon sur R2 lui aussi (`srcMobile` accepte une adresse complète). Une vidéo remplacée sur R2 change de nom (`-v2`), sinon les visiteurs gardent l'ancienne en cache.

Règles :
- **Qualité constante** (`-crf`) plutôt qu'un débit plafonné (`-maxrate`) : un plafond affame précisément les travellings, là où l'œil regarde, et fait apparaître les macroblocs. Pour alléger, augmentez `-crf` d'un cran, ou ajoutez un débruitage léger `hqdn3d=1.5:1.5:4:4,` avant `fps=` (30 à 45 % de moins à qualité égale)
- `-preset veryslow` : l'encodage est fait une fois, le temps ne compte pas, 5 à 10 % de gagné
- Source drone en HDR (D-Log, HLG, Dolby Vision) : convertissez en BT.709, sinon les couleurs sont délavées dans le canvas iOS. Ajoutez avant `fps=` : `zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,`
- `-g 12` ne joue que sur le scroll (la lecture automatique lit la vidéo nativement) : s'il accroche sur le téléphone de test, `-g 8` sur le seul fichier mobile
- En portrait sur téléphone, seul le centre de l'image est visible, agrandi : plus doux qu'en paysage, c'est attendu. Le paysage (plein écran) est l'orientation de référence

### 2. Mettre à jour le JSON

- `media.src` et `media.srcMobile` : chemins des deux fichiers. `srcMobile` peut aussi être une **liste de candidats** (`type` codecs, `media` requête d'écran, `crop` recadrage, `count` cadence) : le premier que le navigateur et l'écran acceptent est lu, voir les options ci-dessus
- `media.smoothTouch` : inertie sur écran tactile (0,25 par défaut, plus directe que `smooth` : le doigt a déjà la sienne)
- `media.count` : nombre d'images des deux fichiers (`ffprobe -count_frames`), utilisé pour le timecode du viseur ; `hud.fps` : 30
- `media.length` : longueur du scroll en hauteurs d'écran (environ 25 à 30 par minute de vidéo)
- `media.pace` : supprimez l'ancien rythme, puis recalculez-le (étape 3)
- `hud.until` : instant où le viseur drone disparaît (fin de l'approche extérieure) ; `hud.fps` : cadence de la vidéo pour le timecode
- `media.slowdowns` : ralentis dans les pièces, `{ "from": 0.24, "to": 0.28, "factor": 3 }` = scroll 3× plus lent entre ces instants

### 3. Caler la visite avec l'éditeur

`npm run dev`, puis ouvrez **http://localhost:5173/?edit** :

1. **Analyser le mouvement** : mesure les passages où l'image bouge vite et leur donne plus de scroll (rythme régulier à l'écran)
2. Choisissez une pièce dans la liste (ou **+ Objet**), scrollez jusqu'à l'instant voulu et **cliquez sur la pièce** dans l'image. Un point tous les 3 à 5 % du parcours suffit : la position est interpolée entre les points
3. L'en-tête de l'éditeur affiche l'instant courant `t` : utilisez-le pour régler les `in` / `out` des chapitres et les ralentis
4. **Télécharger villa.json** (ou **Copier le JSON**) et remplacez `src/data/villa.json`

Le travail en cours est conservé dans le navigateur ; **Réinitialiser** revient au fichier.

L'éditeur n'existe qu'en développement : les visiteurs du site ne le voient pas et ne le téléchargent pas. Pour le montrer sur un site de prévisualisation, créez un fichier `.env.production.local` contenant `VITE_EDITOR=true` avant `npm run build`.

---

## Déploiement

`npm run build` produit un site statique dans `dist/` : Vercel, Netlify, Cloudflare Pages, OVH ou n'importe quel hébergement statique.

- **Sous-dossier** (`https://site.com/villa/`) : renseignez `base: '/villa/'` dans `vite.config.ts` ; tous les chemins de médias suivent automatiquement
- **Partage sur les réseaux** : remplacez `og:image` dans `index.html` par une URL absolue (`https://votre-site.com/media/galerie/aerien.webp`)
- **Vidéo sur un autre domaine** (CDN) : autorisez le CORS pour votre site, sinon la vidéo est lue en streaming et le défilement est moins fluide

### Chargement

La vidéo est entièrement téléchargée en mémoire, puis parcourue une première fois, avant le début de la visite (c'est ce qui rend le défilement fluide dès le premier scroll : aucune requête réseau à chaque image). L'écran de chargement affiche la vraie progression. Le téléchargement démarre à l'ouverture de la page ; les téléphones et petites tablettes (petit côté de l'écran sous 768 px) reçoivent la version mobile, en portrait comme en paysage : tourner le téléphone ne relance pas le téléchargement et garde la position dans la page (sauf candidats liés à l'orientation, voir « Changer la vidéo »).

Aucune détection de navigateur : si le téléchargement échoue (serveur sans CORS) ou si le navigateur refuse la vidéo en mémoire, elle est lue en streaming, sans parcours préalable (plus lent au premier passage). Le canvas est créé opaque et dimensionné à la densité de l'écran (jusqu'à ×3), sans jamais dépasser les pixels que la vidéo apporte à l'écran : l'agrandissement final est laissé à la carte graphique.

## Compatibilité

Navigateurs modernes (Chrome, Edge, Firefox, Safari 16.4+). `prefers-reduced-motion` est respecté (pas d'inertie, pas de déplacement des blocs). Les blocs masqués reçoivent l'attribut `inert` (non focusables).

Plein écran : API Fullscreen sur ordinateur, Android et iPad ; sur iPhone (pas d'API), le bouton passe la visite en mode immersif (en-tête rangé, Safari replie ses barres au défilement) et la page va jusque sous l'encoche (`viewport-fit=cover`).

## Le moteur

`src/lib/scroll-frames/` est indépendant de cette page : `<ScrollSequence>` lit une vidéo ou une séquence d'images au scroll, `<Step in out>` affiche un contenu pendant une portion de la visite, `useSequenceProgress()` donne la progression à chaque image sans re-render. Les options sont documentées dans `engine.ts`.

---

## Licence

Voir `LICENCE.txt`. Prototype de démonstration : avis d'exemple fictifs (`sample: true`), vidéo d'un autre parcours ; tarifs et informations tirés de gap-bayard.com (grille 2026), à faire valider par le client.

## Crédits

- Polices : Instrument Serif, Geist et Geist Mono, Google Fonts (licence SIL Open Font)
- Logo : Golf de Gap-Bayard, propriété du client (`public/media/logo_0.png` d'origine ; `logo-sapin.png` : le vert recoloré en vert sapin pour la maquette, à faire valider)
- Photos du golf et du domaine nordique, plans des trous : Centre d'oxygénation de Gap-Bayard (gap-bayard.com) ; photo aérienne du trou n°3 : Michel Teichet
- Vidéo de démonstration et images des fiches (tirées de la vidéo) : Fly Over Green, autre parcours, provisoire
- Musique : « Calm Instrumental », Kulakovka, Pixabay (licence Pixabay, usage commercial autorisé) : original `kulakovka-calm-instrumental-283168.mp3` à la racine (exclu de Git), version préparée `public/media/ambiance.mp3` (silence final coupé, fondus, 128 kb/s), `audio.volume` 0,4 (niveau moyen mesuré -12,3 dB)
