import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { targetPhone, message } = await request.json();

    // Example integration using Fonnte API (or Twilio / UltraMsg)
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': process.env.FONNTE_TOKEN || '', // Add TOKEN to .env.local
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: targetPhone,
        message: message,
        countryCode: '60', // Malaysia country code
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}