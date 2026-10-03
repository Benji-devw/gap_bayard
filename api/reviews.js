/**
 * Vrais avis Google du bien, pour la section « avis » (villa.json : sections.reviews.api = "/api/reviews").
 *
 * Fonction serverless au format Vercel (dossier api/ à la racine du projet, déployé automatiquement).
 * Netlify : même code dans netlify/functions/, Cloudflare Pages : functions/api/reviews.js (adapter la signature).
 *
 * Variables d'environnement du projet (jamais dans le code ni dans le navigateur) :
 *   GOOGLE_MAPS_API_KEY  clé Google Cloud avec « Places API (New) » activée, restreinte à cette API
 *   GOOGLE_PLACE_ID      identifiant du lieu : https://developers.google.com/maps/documentation/places/web-service/place-id
 *
 * À savoir :
 * - l'API renvoie au plus 5 avis, choisis par Google ; la note et le nombre total d'avis sont ceux du lieu ;
 * - conditions Google : afficher « Avis Google », le nom de l'auteur et le lien vers son profil (fait par Reviews.tsx),
 *   ne pas modifier les textes ; cache court seulement (1 h ici).
 */
export default async function handler(req, res) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const place = process.env.GOOGLE_PLACE_ID;
  if (!key || !place) {
    res.status(501).json({ error: 'GOOGLE_MAPS_API_KEY ou GOOGLE_PLACE_ID manquant' });
    return;
  }

  const lang = typeof req.query?.lang === 'string' ? req.query.lang.slice(0, 5) : 'fr';
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(place)}?languageCode=${encodeURIComponent(lang)}`;

  try {
    const r = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'rating,userRatingCount,googleMapsUri,reviews',
      },
    });
    if (!r.ok) {
      res.status(502).json({ error: `Google Places : HTTP ${r.status}` });
      return;
    }
    const p = await r.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.status(200).json({
      source: 'google',
      rating: p.rating ?? null,
      count: p.userRatingCount ?? 0,
      url: p.googleMapsUri ?? null,
      items: (p.reviews ?? [])
        .map((v) => ({
          name: v.authorAttribution?.displayName ?? '',
          profile: v.authorAttribution?.uri ?? null,
          photo: v.authorAttribution?.photoUri ?? null,
          date: v.relativePublishTimeDescription ?? '',
          rating: v.rating ?? 5,
          text: v.text?.text ?? v.originalText?.text ?? '',
        }))
        .filter((v) => v.name && v.text),
    });
  } catch (err) {
    res.status(502).json({ error: `Google Places injoignable : ${err instanceof Error ? err.message : String(err)}` });
  }
}
