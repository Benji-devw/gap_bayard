import { useEffect, useState, type FormEvent } from 'react';
import type { UiText, VillaData } from '../types';

type Contact = VillaData['sections']['contact'];

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Demande de réservation (dates, voyageurs, coordonnées).
 * Renseignez `sections.contact.formAction` (Formspree, Netlify Forms, votre API…) pour envoyer les demandes ;
 * sans URL, le formulaire fonctionne en mode démo et n'envoie rien.
 */
interface BookingFormProps {
  contact: Contact;
  labels: UiText['form'];
  /** Séjour choisi dans le calendrier des disponibilités : remplit l'arrivée et le départ */
  dates?: { arrival: string; departure: string } | null;
}

export function BookingForm({ contact, labels, dates }: BookingFormProps) {
  const [sent, setSent] = useState(false);
  const [arrival, setArrival] = useState('');
  const [departure, setDeparture] = useState('');

  useEffect(() => {
    if (!dates) return;
    setArrival(dates.arrival);
    setDeparture(dates.departure);
  }, [dates]);

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
    <form className="vl-form" action={contact.formAction || undefined} method="post" onSubmit={onSubmit}>
      <label>
        <span>{labels.arrival}</span>
        <input name="arrival" type="date" min={today()} required value={arrival} onChange={(e) => setArrival(e.target.value)} />
      </label>
      {!contact.singleDate && (
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
      )}
      <label>
        <span>{labels.guests}</span>
        <input name="guests" type="number" min={1} max={contact.maxGuests} defaultValue={2} required />
      </label>
      <label>
        <span>{labels.name}</span>
        <input name="name" autoComplete="name" required />
      </label>
      <label className="vl-form-wide">
        <span>{labels.email}</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="vl-form-wide">
        <span>{labels.message}</span>
        <textarea name="message" rows={3} />
      </label>
      <button type="submit" className="vl-btn">
        {contact.submitLabel}
      </button>
    </form>
  );
}
