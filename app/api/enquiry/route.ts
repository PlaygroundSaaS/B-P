import { NextResponse } from 'next/server';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, maximum: number) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] || character);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Please complete the enquiry form.' }, { status: 400 });
  if (text(body.company, 200)) return NextResponse.json({ message: 'Thank you — your enquiry has been sent.' });

  const name = text(body.name, 120);
  const email = text(body.email, 200).toLowerCase();
  const occasion = text(body.occasion, 120);
  const message = text(body.message, 4000);

  if (!name || !email || !occasion || !message || !emailPattern.test(email)) {
    return NextResponse.json({ error: 'Please enter your name, a valid email address and your enquiry.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.ENQUIRY_TO_EMAIL || 'info@bramblesandpetals.co.uk';
  if (!apiKey || !from) {
    return NextResponse.json({ error: 'The enquiry service is not ready yet. Please email info@bramblesandpetals.co.uk directly.' }, { status: 503 });
  }

  const html = `<div style="font-family:Arial,sans-serif;color:#333;line-height:1.6"><h1 style="font-size:22px">New website enquiry</h1><p><strong>Name:</strong> ${escapeHtml(name)}<br><strong>Email:</strong> ${escapeHtml(email)}<br><strong>Occasion:</strong> ${escapeHtml(occasion)}</p><p><strong>Message:</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}</p></div>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], reply_to: email, subject: `Website enquiry — ${occasion} — ${name}`, html }),
  });

  if (!response.ok) {
    console.error('Resend enquiry send failed', await response.text());
    return NextResponse.json({ error: 'We could not send your enquiry just now. Please try again or email us directly.' }, { status: 502 });
  }

  return NextResponse.json({ message: 'Thank you — your enquiry has been sent. We’ll be in touch soon.' });
}

