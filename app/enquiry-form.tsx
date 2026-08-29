'use client';

import { FormEvent, useState } from 'react';

const occasionDetails: Record<string, { prompt: string; placeholder: string }> = {
  Wedding: {
    prompt: 'Tell us about the day',
    placeholder: 'Your venue, colour palette, arrangements you may need and anything you already know about the day…',
  },
  'Funeral flowers': {
    prompt: 'Tell us how we can help',
    placeholder: 'The service date, tribute or arrangement you have in mind, meaningful flowers or colours, and delivery details if known…',
  },
  'Corporate event': {
    prompt: 'Tell us about the event',
    placeholder: 'The event format, venue, brand colours, number of tables or spaces, and setup timing if known…',
  },
  'Everyday flowers': {
    prompt: 'Tell us what you have in mind',
    placeholder: 'The occasion, favourite colours or flowers, budget and collection or delivery date…',
  },
  Other: {
    prompt: 'How can we help?',
    placeholder: 'Share as much or as little as you know. We can explore the rest together…',
  },
};

export default function EnquiryForm() {
  const [occasion, setOccasion] = useState('Wedding');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const detail = occasionDetails[occasion] ?? occasionDetails.Other;

  async function sendEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    const form = event.currentTarget;

    try {
      const response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const contentType = response.headers.get('content-type') || '';
      const result = contentType.includes('application/json')
        ? await response.json() as { error?: string; message?: string }
        : {};
      if (!response.ok) throw new Error(result.error || 'We could not send your enquiry. Please try again or email us directly.');
      form.reset();
      setOccasion('Wedding');
      setStatus({ type: 'success', message: result.message || 'Thank you — your enquiry has been sent. We will be in touch shortly.' });
    } catch (caught) {
      setStatus({ type: 'error', message: caught instanceof Error ? caught.message : 'We could not send your enquiry. Please try again or email us directly.' });
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="bp-enquiry-form" onSubmit={sendEnquiry}>
    <div className="bp-field bp-field-wide">
      <label htmlFor="enquiry-occasion">What are you planning?</label>
      <select id="enquiry-occasion" name="occasion" value={occasion} onChange={event => setOccasion(event.target.value)}>
        <option>Wedding</option>
        <option>Funeral flowers</option>
        <option>Corporate event</option>
        <option>Everyday flowers</option>
        <option>Other</option>
      </select>
    </div>
    <div className="bp-field">
      <label htmlFor="enquiry-name">Your name</label>
      <input id="enquiry-name" name="name" autoComplete="name" required />
    </div>
    <div className="bp-field">
      <label htmlFor="enquiry-email">Email address</label>
      <input id="enquiry-email" name="email" type="email" autoComplete="email" required />
    </div>
    <div className="bp-field">
      <label htmlFor="enquiry-phone">Phone number <span>Optional</span></label>
      <input id="enquiry-phone" name="phone" type="tel" autoComplete="tel" />
    </div>
    <div className="bp-field">
      <label htmlFor="enquiry-date">Event or delivery date <span>Optional</span></label>
      <input id="enquiry-date" name="eventDate" type="date" />
    </div>
    <div className="bp-field bp-field-wide">
      <label htmlFor="enquiry-location">Venue or delivery area <span>Optional</span></label>
      <input id="enquiry-location" name="location" autoComplete="street-address" />
    </div>
    <div className="bp-field bp-field-wide">
      <label htmlFor="enquiry-message">{detail.prompt}</label>
      <textarea id="enquiry-message" name="message" placeholder={detail.placeholder} required />
    </div>
    <input className="landing-honeypot" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
    <div className="bp-form-action bp-field-wide">
      <button className="bp-button" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Send your enquiry'}</button>
      <p>We usually reply within two working days.</p>
    </div>
    {status && <div className={`landing-enquiry-status ${status.type} bp-field-wide`} role={status.type === 'error' ? 'alert' : 'status'}>
      <strong>{status.type === 'success' ? 'Enquiry sent' : 'We could not send that'}</strong>
      <span>{status.message}</span>
      {status.type === 'error' && <a href="mailto:info@bramblesandpetals.co.uk">Email info@bramblesandpetals.co.uk instead</a>}
    </div>}
  </form>;
}
