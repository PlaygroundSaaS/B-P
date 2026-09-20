import { createHash } from 'node:crypto';
import { captureWebsiteEnquiry } from '@/lib/website-enquiry';
import { NextResponse } from 'next/server';
import { readJsonObject, requireSameOrigin, RequestError } from '@/lib/request-body';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, maximum: number) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] || character);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { requireSameOrigin(request); body = await readJsonObject(request); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Please complete the enquiry form.' }, { status: error instanceof RequestError ? error.status : 400 }); }
  if (text(body.company, 200)) return NextResponse.json({ message: 'Thank you — your enquiry has been sent.' });

  const name = text(body.name, 120);
  const email = text(body.email, 200).toLowerCase();
  const occasion = text(body.occasion, 120);
  const phone = text(body.phone, 80);
  const eventDate = text(body.eventDate, 30);
  const location = text(body.location, 300);
  const message = text(body.message, 4000);

  if (!name || !email || !['Wedding', 'Funeral flowers', 'Corporate event', 'Everyday flowers', 'Other'].includes(occasion) || !message || !emailPattern.test(email)) {
    return NextResponse.json({ error: 'Please enter your name, a valid email address and your enquiry.' }, { status: 400 });
  }

  const captured = await captureWebsiteEnquiry({ name, email, phone, occasion, eventDate, location, message });
  if (!captured) return NextResponse.json({ error: 'We could not save your enquiry just now. Your details are still here; please try again or email info@bramblesandpetals.co.uk.' }, { status: 503 });
  const received = () => NextResponse.json({ message: 'Thank you — your enquiry has been received by our studio. We’ll be in touch soon.' });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.ENQUIRY_TO_EMAIL || 'info@bramblesandpetals.co.uk';
  if (!apiKey || !from) {
    console.warn('[enquiry] Saved to Studio; email notification is not configured.');
    return received();
  }

  const optionalDetails = [
    phone ? `<strong>Phone:</strong> ${escapeHtml(phone)}` : '',
    eventDate ? `<strong>Event / delivery date:</strong> ${escapeHtml(eventDate)}` : '',
    location ? `<strong>Venue / area:</strong> ${escapeHtml(location)}` : '',
  ].filter(Boolean).join('<br>');
  const html = `<div style="font-family:Arial,sans-serif;color:#333;line-height:1.6"><h1 style="font-size:22px">New website enquiry</h1><p><strong>Name:</strong> ${escapeHtml(name)}<br><strong>Email:</strong> ${escapeHtml(email)}<br><strong>Occasion:</strong> ${escapeHtml(occasion)}${optionalDetails ? `<br>${optionalDetails}` : ''}</p><p><strong>Message:</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}</p></div>`;
  let response: Response;
  try { response = await fetch('https://api.resend.com/emails', {
    signal: AbortSignal.timeout(15000),
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `enquiry-${createHash('sha256').update(JSON.stringify({ name, email, phone, occasion, eventDate, location, message, date: new Date().toISOString().slice(0, 10) })).digest('hex')}` },
    body: JSON.stringify({ from, to: [to], reply_to: email, subject: `Website enquiry — ${occasion} — ${name}`, html }),
  }); } catch {
    console.warn('[enquiry] Saved to Studio; email notification timed out or failed.');
    return received();
  }

  if (!response.ok) {
    console.warn('[enquiry] Saved to Studio; email notification failed', response.status);
    return received();
  }

  return received();
}

