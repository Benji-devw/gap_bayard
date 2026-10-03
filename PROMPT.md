# Modifier le site avec une IA

Tout le contenu du site est dans `src/data/villa.json`. Une IA (Claude, ChatGPT…) peut le réécrire pour vous en une fois.

1. Copiez le prompt ci-dessous et complétez les `[crochets]`
2. Joignez `src/data/villa.json` (et `src/data/villa.schema.json` si l'outil accepte plusieurs fichiers)
3. Remplacez `src/data/villa.json` par la réponse, puis vérifiez avec `npm run dev`

Avec un assistant de code (Claude Code, Cursor…) ouvert dans le projet, pas besoin de joindre les fichiers : demandez-lui directement de modifier `src/data/villa.json` en lui donnant le même prompt.

---

## Le prompt

```text
Tu modifies le fichier de contenu d'un site de location saisonnière : villa.json (joint), dont la structure est décrite par villa.schema.json.

Règles :
- Réponds uniquement avec le fichier villa.json complet et valide, sans commentaire autour.
- Garde la même structure et les mêmes clés, y compris "$schema".
- Ne touche pas à media.pace, media.slowdowns, ni aux "track" des hotspots, sauf si je le demande.
- Les instants ("in", "out", "from", "to", et le premier nombre de chaque point de "track") vont de 0 (début de la vidéo) à 1 (fin).
- Les chemins d'images et de vidéos sont relatifs au dossier public/ (ex. "media/pieces/salon.webp").
- Chaque hotspot garde un "id" unique en minuscules, sans espace ni accent.
- Les hotspots sont les pièces, dans l'ordre du parcours (leur ordre donne les numéros affichés).
- Les couleurs sont en hexadécimal ; "ink" est la couleur sombre (voiles, pied de page), "accent" la couleur des boutons et points, "accent2" celle des notes manuscrites et des coches.
- Langue : [français]. Ton : [élégant et chaleureux], phrases courtes, pas de superlatifs creux.

Mes changements :
- Bien : [nom, lieu, voyageurs, chambres, salles de bain, surface, prix à la nuit, séjour minimum]
- Points forts : [vue, piscine, équipements…]
- Ambiance et couleurs : [ex. "bord de mer, blanc et bleu profond" ou codes couleur]
- Pièces : [pour chaque pièce : nom, étage, légende manuscrite, description, équipements]
- Bon à savoir : [arrivée, départ, animaux, fumeurs, caution…]
- Hôte : [nom, rôle, téléphone, e-mail, petit mot]
- Autre : [pied de page, mentions…]
```

---

## Prompts ciblés

À ajouter à la place de « Mes changements » quand vous ne voulez changer qu'une partie.

### Placer les pièces sur une nouvelle vidéo

Pas besoin de coordonnées précises : décrivez le moment et l'endroit, l'IA crée des positions simples (`at`). Vous pourrez ensuite les affiner à la souris avec l'éditeur (`?edit`).

```text
La vidéo dure [132] secondes. Remplace tous les hotspots par ceux-ci, en mode simple "at"
(from/to = secondes ÷ durée, x/y de 0 à 1 depuis le coin haut-gauche de l'image), et supprime leur "track" :
- [Le salon] : de [0:12] à [0:15], [au centre]
- [La cuisine] : de [0:15] à [0:19], [en bas à droite]
Ajoute aussi dans media.slowdowns un ralenti (factor 2) sur chacune de ces plages, et un chapitre
« Étape n / total » (bottom-left et bottom-right en alternance) sur chaque plage.
```

### Changer les pièces sans toucher aux positions

```text
Garde les "id", "track" et "at" des hotspots, mais remplace leurs textes (label, title, category, note,
description, details, features) par ceux-ci : [liste par id]
```

### Traduire le site

```text
Traduis tous les textes du site en [anglais], y compris le bloc "ui" et meta.title / meta.description.
Mets meta.lang à "[en]". Adapte les formats (prix, surfaces, téléphone) aux usages du pays.
```

### Changer le style

```text
Propose un nouveau thème ([ex. "minimal, noir et doré"]) : modifie uniquement "theme" (couleurs et polices
Google Fonts, avec l'URL fonts.url correspondante). Garde un contraste lisible entre fg et bg.
```

---

## Vérifier le résultat

- `npm run dev` : les erreurs du JSON s'affichent dans la console du navigateur
- VS Code souligne les clés inconnues ou mal typées grâce au schéma
- `npm run build` doit se terminer sans erreur avant la mise en ligne
