import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    error: 'The enquiry service is being connected. Please email info@bramblesandpetals.co.uk directly for now.',
  }, { status: 503 });
}

