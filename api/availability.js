/**
 * Disponibilités réelles du bien, pour le calendrier de la réservation
 * (villa.json : sections.contact.availability.api = "/api/availability").
 *
 * Lit le calendrier iCal du bien et renvoie les nuits réservées : { source, booked: [{ from, to }] }
 * (`to` = jour du départ, dates AAAA-MM-JJ).
 *
 * Fonction serverless au format Vercel (dossier api/). Variable d'environnement (jamais dans le code) :
 *   ICAL_URL  adresse iCal privée du calendrier :
 *             - Google Agenda : Paramètres de l'agenda › « Adresse secrète au format iCal »
 *             - Airbnb : Calendrier › Disponibilités › « Exporter le calendrier »
 *             - Booking.com : Calendrier › « Synchroniser les calendriers » › exporter
 *             Plusieurs calendriers : séparer les adresses par des virgules.
 */
function unfold(text) {
  return text.replace(/\r?\n[ \t]/g, '');
}

/** DTSTART / DTEND → AAAA-MM-JJ (date seule, ou date-heure ramenée au jour) */
function day(value) {
  const m = /(\d{4})(\d{2})(\d{2})/.exec(value || '');
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function parseIcs(text) {
  const out = [];
  for (const block of unfold(text).split('BEGIN:VEVENT').slice(1)) {
    const get = (key) => {
      const line = block.split(/\r?\n/).find((l) => l.startsWith(key + ':') || l.startsWith(key + ';'));
      return line ? line.slice(line.indexOf(':') + 1).trim() : null;
    };
    if ((get('STATUS') || '').toUpperCase() === 'CANCELLED') continue;
    const from = day(get('DTSTART'));
    let to = day(get('DTEND')) || from;
    if (!from) continue;
    if (to <= from) {
      const d = new Date(`${from}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      to = d.toISOString().slice(0, 10);
    }
    out.push({ from, to });
  }
  return out;
}

export default async function handler(req, res) {
  const urls = (process.env.ICAL_URL || '').split(',').map((u) => u.trim()).filter(Boolean);
  if (!urls.length) {
    res.status(501).json({ error: 'ICAL_URL manquant' });
    return;
  }
  try {
    const texts = await Promise.all(
      urls.map(async (u) => {
        const r = await fetch(u);
        if (!r.ok) throw new Error(`HTTP ${r.status} pour un calendrier`);
        return r.text();
      }),
    );
    const today = new Date().toISOString().slice(0, 10);
    const booked = texts.flatMap(parseIcs).filter((r) => r.to >= today);
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
    res.status(200).json({ source: 'ical', booked });
  } catch (err) {
    res.status(502).json({ error: `Calendrier injoignable : ${err instanceof Error ? err.message : String(err)}` });
  }
}
