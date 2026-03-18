import { NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function GET() {
  console.log('Testing Resend API...');
  console.log('RESEND_API_KEY exists:', !!RESEND_API_KEY);
  
  if (!RESEND_API_KEY) {
    return NextResponse.json({ 
      error: 'RESEND_API_KEY not configured',
      message: 'Check Vercel environment variables'
    }, { status: 500 });
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Stock Analyzer <onboarding@resend.dev>',
        to: 'jferrerasdiaz@gmail.com',
        subject: '🧪 Test Email - Stock Analyzer',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #238636;">✅ Test Email</h1>
            <p>Este es un email de prueba de Stock Analyzer.</p>
            <p>Si recibes este email, Resend está funcionando correctamente.</p>
            <p><strong>Fecha:</strong> ${new Date().toISOString()}</p>
          </div>
        `,
      }),
    });

    const data = await response.json();
    console.log('Resend response:', response.status, data);
    
    if (!response.ok) {
      return NextResponse.json({ 
        error: 'Failed to send email',
        status: response.status,
        data
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Email sent successfully',
      data
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ 
      error: String(error)
    }, { status: 500 });
  }
}
