import { useEffect, useState, type FormEvent } from 'react';
import type { ContactTopic, UiText, VillaData } from '../types';

type Contact = VillaData['sections']['contact'];

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Demande de contact ou de réservation.
 * Avec `contact.topics` : l'objet de la demande en pastilles (séjour, golf, séminaire…), qui règle les dates
 * (arrivée et départ, date souhaitée ou aucune) et l'invitation du message ; l'objet de l'univers affiché est
 * choisi d'office tant que le visiteur n'en a pas choisi un. Sans : dates, voyageurs, coordonnées (`singleDate`).
 * Renseignez `contact.formAction` (Formspree, Netlify Forms, votre API…) pour envoyer les demandes ;
 * sans URL, le formulaire fonctionne en mode démo et n'envoie rien.
 */
interface BookingFormProps {
  contact: Contact;
  labels: UiText['form'];
  /** Séjour choisi dans le calendrier des disponibilités : remplit l'arrivée et le départ */
  dates?: { arrival: string; departure: string } | null;
  /** Univers affiché : son objet de demande est choisi d'office */
  universe?: string;
}

export function BookingForm({ contact, labels, dates, universe }: BookingFormProps) {
  const [sent, setSent] = useState(false);
  const [arrival, setArrival] = useState('');
  const [departure, setDeparture] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (!dates) return;
    setArrival(dates.arrival);
    setDeparture(dates.departure);
  }, [dates]);

  const topics = contact.topics ?? [];
  const topic: ContactTopic | undefined =
    topics.find((t) => t.id === picked) ?? topics.find((t) => t.universe && t.universe === universe) ?? topics[0];
  const mode = topic ? topic.dates : contact.singleDate ? 'single' : 'range';

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (contact.formAction) return; // envoi natif vers le service configuré
    e.preventDefault();
    setSent(true);
  };

  if (sent) {
    return (
      <p className="vl-form-success" role="status">
        {contact.successMessage}
      </p>
    );
  }

  return (
    <form className="vl-form" data-dates={mode} action={contact.formAction || undefined} method="post" onSubmit={onSubmit}>
      {topic && (
        <fieldset className="vl-form-topics">
          <legend>{labels.topic}</legend>
          <div>
            {topics.map((t) => (
              <label key={t.id} className="vl-form-topic">
                <input
                  type="radio"
                  name="topic"
                  value={t.label}
                  checked={t.id === topic.id}
                  onChange={() => setPicked(t.id)}
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {mode === 'range' && (
        <>
          <label>
            <span>{labels.arrival}</span>
            <input name="arrival" type="date" min={today()} required value={arrival} onChange={(e) => setArrival(e.target.value)} />
          </label>
          <label>
            <span>{labels.departure}</span>
            <input
              name="departure"
              type="date"
              min={arrival || today()}
              required
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
            />
          </label>
        </>
      )}
      {mode === 'single' && (
        <label>
          <span>{topic ? labels.date : labels.arrival}</span>
          <input name="date" type="date" min={today()} value={arrival} onChange={(e) => setArrival(e.target.value)} />
        </label>
      )}
      <label>
        <span>{labels.guests}</span>
        <input name="guests" type="number" min={1} max={contact.maxGuests} defaultValue={2} required />
      </label>
      {topic && mode !== 'single' && (
        <label>
          <span>{labels.phone}</span>
          <input name="phone" type="tel" autoComplete="tel" />
        </label>
      )}
      <label>
        <span>{labels.name}</span>
        <input name="name" autoComplete="name" required />
      </label>
      {topic && mode === 'single' && (
        <label>
          <span>{labels.phone}</span>
          <input name="phone" type="tel" autoComplete="tel" />
        </label>
      )}
      {/* e-mail seul sur sa ligne quand il n'a pas de voisin (une date avec objets, ou formulaire simple à deux dates) */}
      <label className={(topic && mode === 'single') || (!topic && mode === 'range') ? 'vl-form-wide' : undefined}>
        <span>{labels.email}</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="vl-form-wide">
        <span>{labels.message}</span>
        <textarea name="message" rows={3} placeholder={topic?.message} />
      </label>
      <div className="vl-form-foot">
        <button type="submit" className="vl-btn">
          {contact.submitLabel}
        </button>
        {contact.privacy && (
          <p className="vl-form-privacy">
            {contact.privacy}
          </p>
        )}
      </div>
    </form>
  );
}
