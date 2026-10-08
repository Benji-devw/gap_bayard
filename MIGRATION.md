# Reprise du site gap-bayard.com — procédure

Interne. Constats vérifiés le 7 octobre 2026 (DNS, RDAP, plan du site). À relire avant chaque étape : rien ne se coupe avant que le nouveau site soit prêt.

## Ce qu'il y a aujourd'hui

| Élément | Constat | Conséquence |
|---|---|---|
| Nom de domaine | `gap-bayard.com`, bureau d'enregistrement **OVH**, créé en 2006, **expire le 21 décembre 2026**, transfert verrouillé (normal) | Savoir **à quel compte OVH** il appartient (Centre ou WebSenso). Le renouvellement tombe en plein projet : à vérifier en premier |
| DNS | Serveurs OVH (`dns110` / `ns110.ovh.net`) | On garde OVH, on change seulement les lignes du site |
| E-mails | `contact@gap-bayard.com` chez OVH (MX `mx3`, `mx4`, `mxb.ovh.net`) ; SPF : `mx include:mx.ovh.com include:_spf.websenso.com -all` | **Ne jamais toucher aux MX** : les e-mails du Centre continuent de passer par OVH |
| Site | Drupal 7 sur un serveur Apache (`178.33.179.195`), développé et maintenu par WebSenso, design Piment Rouge | Contrat de maintenance WebSenso à résilier **après** la mise en ligne, selon son préavis |
| Pages | 274 adresses dans le plan du site : 117 événements, 87 actualités, 17 galeries, pages séjours, tarifs, activités | Redirections à prévoir, et une solution pour les actualités et événements |
| Fonctions sur mesure | **Plan des pistes en direct** (`/nordic/bayard`, modules WebSenso `ws_pistes`), lettre d'information « Restez informé », formulaire de contact, application mobile « Nordic Bayard » | Le plan des pistes vit dans leur Drupal : il **disparaît** avec lui. Voir « Fonctions à remplacer » |
| Services externes | prima.golf (départs), billetterie nordique (intence.tech), webcam (viewsurf), Fly Over Green | Simples liens, rien à migrer |
| Documents | Tarifs en PDF sur leur serveur (`/sites/gap-bayard.com/files/…`) | Le prototype pointe vers ces PDF : **les rapatrier** dans le nouveau site avant la bascule |

## 1. Avant de signer : questions au directeur

- Qui est titulaire du compte OVH (domaine et e-mails) : le Centre ou WebSenso ? Avez-vous les identifiants ?
- Le domaine expire le 21 décembre 2026 : est-il en renouvellement automatique ?
- Contrat WebSenso : durée, préavis, ce qu'il couvre (hébergement, e-mails, plan des pistes, application ?)
- Qui gère la fiche Google du golf (et celle du domaine nordique) ? Avec quel compte ?
- Google Analytics, Search Console : existent-ils, sur quel compte ?
- Le plan des pistes et l'application Nordic Bayard : qui les met à jour l'hiver (pistes ouvertes) ? Indispensables ?
- Actualités et événements : qui les publie, à quel rythme ?
- Forme juridique du Centre (association, régie, SPL…) : si c'est public, procédure d'achat et accessibilité (RGAA) obligatoires

## 2. Contrat et accès

- Devis signé, acompte 30 %, licence d'utilisation du code (le code reste à Navart, les contenus au Centre), forfait annuel d'hébergement et maintenance chiffré pour un site multi-services (le Pack Zen, 150 – 350 €/an, est calibré pour un site simple : viser 400 – 600 €/an)
- **Le Centre reste titulaire de tout** (domaine, e-mails, fiche Google, comptes Google) : Navart reçoit des accès délégués, jamais la propriété. C'est aussi ce qui rassure face à « et si on arrête avec vous ? »
- Récupérer auprès de WebSenso, par écrit et avant la résiliation : export des contenus (textes, images, PDF, actualités), liste des redirections existantes, accès DNS si le domaine est sur leur compte
- Ne résilier WebSenso qu'**après** la bascule et une semaine de vérifications

## 3. Nom de domaine

- **Ne pas le transférer** : inutile, risqué (e-mails), et le Centre doit en rester propriétaire. On modifie seulement sa zone DNS
- OVH : faire ajouter Navart en **contact technique** du domaine (gestion des contacts, sans transfert de propriété), ou travailler avec le compte du Centre en sa présence
- Si le domaine est sur le compte de WebSenso : demander un changement de contact titulaire / administrateur vers le compte OVH du Centre (procédure « changement de contacts » d'OVH, gratuite, sans transfert)
- Vérifier le **renouvellement automatique** avant le 21 décembre 2026
- 48 h avant la bascule : baisser le TTL des lignes `@` et `www` (ex. 300 s)

## 4. E-mails : ne rien casser

- Les lignes **MX, SPF (TXT), DKIM** et les e-mails restent chez OVH, intacts
- On ne remplace que la ligne `A` de `gap-bayard.com` et la ligne de `www` (voir « Hébergement »)
- Si `_spf.websenso.com` sert à l'envoi du formulaire actuel, le retirer du SPF seulement après la résiliation de WebSenso
- Formulaire du nouveau site : Formspree (ou équivalent) vers `contact@gap-bayard.com`, avec un test d'envoi réel

## 5. Hébergement

- **Vercel gratuit (Hobby) est réservé à un usage non commercial** (un site qu'on est payé pour créer ou héberger est commercial) : passer le compte Navart en **Vercel Pro** (20 $/mois par développeur, **un seul abonnement pour tous les sites clients**, 20 $ de crédit d'usage inclus) ou passer sur **Cloudflare Pages** (gratuit, usage commercial autorisé, même compte que la vidéo sur R2). Sur Cloudflare Pages, les fonctions `api/reviews.js` et `api/availability.js` sont à déplacer dans `functions/api/` (voir l'en-tête de ces fichiers)
- Vidéo : déjà sur Cloudflare R2 (bucket `landing-studio`), ajouter le nouveau domaine au CORS du bucket
- Brancher le domaine : `gap-bayard.com` et `www.gap-bayard.com` sur l'hébergeur (lignes données par Vercel ou Cloudflare), une adresse principale (`www`), l'autre redirigée ; certificat HTTPS automatique
- Avant la bascule : retirer le `noindex` (balise `robots` de `index.html` et en-tête `X-Robots-Tag` de `vercel.json`)

## 6. Contenus et fonctions à remplacer

- **Tarifs en PDF** : télécharger les PDF utiles (golf, hébergement, nordique) dans `public/docs/` et changer les liens du JSON
- **Plan des pistes en direct** : choisir avec le Centre (a) garder l'ancien Drupal en ligne sur un sous-domaine (`pistes.gap-bayard.com`) le temps de reconstruire, (b) une carte des pistes simple (image + pistes ouvertes saisies dans le JSON), ou (c) un outil spécialisé. Vérifier si l'application Nordic Bayard en dépend
- **Actualités et événements** : section « Actualités » alimentée par le JSON (ou par une feuille Google), sans reprendre les 200 anciennes ; rediriger les anciennes adresses
- **Lettre d'information** : où sont les inscrits ? Exporter la liste (RGPD) vers un outil (Brevo, Mailchimp) ou l'abandonner proprement
- **Webcam, météo** : liens ou intégrations dans l'univers Nordique
- **Mentions légales, confidentialité** : à réécrire (éditeur : le Centre ; directeur de publication : Michel Girard ; hébergeur : Vercel ou Cloudflare, avec adresse ; réalisation : Navart). Pas de cookies publicitaires : pas de bandeau nécessaire
- **Vidéo** : remplacer le survol Fly Over Green par le tournage FPV du golf avant toute mise en ligne

## 7. Google

- **Fiche d'établissement (Google Business Profile)** : le Centre reste **propriétaire** ; il ajoute Navart comme **gestionnaire**. Vérifier le lien du site (même domaine : rien à changer), les horaires, les photos ; une fiche pour le golf, une pour le domaine nordique si elles existent
- **Avis Google sur le site** : clé API Places (Google Cloud, facturation activée, quota gratuit largement suffisant) + Place ID de la fiche, en variables d'environnement de l'hébergeur ; puis `sections.reviews.api` et `sample: false`. Retirer les avis d'exemple
- **Search Console** : propriété « domaine » vérifiée par une ligne TXT dans la zone DNS OVH ; envoyer le plan du site ; surveiller les erreurs 404 le premier mois
- **Analytics** : si le Centre en veut, une mesure sans cookie (Plausible, Matomo sans cookie) évite le bandeau de consentement

## 8. Référencement : les redirections

- Garder la valeur des 274 anciennes adresses : **redirections 301** vers les nouvelles ancres, dans `vercel.json` (`redirects`) ou `_redirects` (Cloudflare)
- Exemples : `/golf`, `/golf-de-gap-bayard`, `/tarifs-golf` → `/#golf` (ou `/#tarifs`) ; `/hebergement-restauration`, `/tarifs-hebergement-et-restauration`, `/votre-seminaire-gap-bayard` → `/#sejourner` ; `/hiver`, `/station-nordique`, `/espace-nordique-de-ski-de-fond`, `/tarifs-domaine-nordique` → `/#nordique` ; `/infos-pratiques`, `/venir-au-centre`, `/navette-gap-bayard` → `/#infos` ; `/actualites/*`, `/evenements/*` → page ou section Actualités ; le reste → `/`
- Une redirection ne garde pas l'ancre côté Google : prévoir à terme de vraies pages (`/golf`, `/sejourner`, `/nordique`) si le référencement compte beaucoup

## 9. Jour J

1. J-7 : site complet sur l'adresse de préproduction, validé par le directeur, testé (ordinateur, iPhone, Android, téléphone couché)
2. J-2 : TTL baissé ; PDF rapatriés ; redirections et mentions légales prêtes ; `noindex` retiré dans une branche prête à déployer
3. J0 (en semaine, le matin, hors saison) : déployer, changer les lignes `A` / `www` chez OVH, vérifier HTTPS, e-mails (envoyer et recevoir un message sur `contact@`), formulaire, prima.golf, billetterie
4. J+1 : Search Console (plan du site, erreurs), fiche Google, avis
5. J+7 : tout va bien → courrier de résiliation à WebSenso ; ancien serveur gardé jusqu'à la fin du préavis (retour arrière possible : remettre l'ancienne ligne `A`)
6. J+30 : bilan 404 et trafic, ajustements
