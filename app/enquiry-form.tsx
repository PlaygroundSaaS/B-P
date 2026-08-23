'use client';

import { FormEvent, useState } from 'react';

export default function EnquiryForm() {
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || 'We could not send your enquiry. Please try again.');
      form.reset();
      setStatus({ type: 'success', message: result.message || 'Thank you — your enquiry has been sent.' });
    } catch (caught) {
      setStatus({ type: 'error', message: caught instanceof Error ? caught.message : 'We could not send your enquiry. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return <form onSubmit={sendEnquiry}>
    <input name="name" placeholder="Your name" autoComplete="name" required />
    <input name="email" type="email" placeholder="Email address" autoComplete="email" required />
    <select name="occasion" defaultValue="Wedding"><option>Wedding</option><option>Funeral flowers</option><option>Corporate event</option><option>Everyday flowers</option><option>Other</option></select>
    <textarea name="message" placeholder="Tell us what you have in mind" required />
    <input className="landing-honeypot" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
    <button className="landing-button" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Send enquiry'}</button>
    {status && <p className={`landing-enquiry-status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>{status.message}</p>}
  </form>;
}

