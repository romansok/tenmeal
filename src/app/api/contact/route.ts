import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const PLAN_LABELS: Record<string, string> = {
  '3meals': '3 ארוחות — ₪55',
  '5meals': '5 ארוחות — ₪110',
  '24meals': '24 ארוחות — ₪456',
}

export async function POST(request: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { name, phone, email, message, plan } = await request.json()

    if (!name || !phone) {
      return NextResponse.json({ error: 'שם וטלפון הם שדות חובה' }, { status: 400 })
    }

    const planLabel = plan ? PLAN_LABELS[plan] ?? plan : 'לא נבחרה חבילה'

    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #FF6B35; border-bottom: 2px solid #FF6B35; padding-bottom: 8px;">
          פנייה חדשה מ-${name}
        </h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #2C1810; width: 120px;">שם:</td>
            <td style="padding: 8px 0; color: #2C1810;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #2C1810;">טלפון:</td>
            <td style="padding: 8px 0; color: #2C1810;">${phone}</td>
          </tr>
          ${email ? `
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #2C1810;">אימייל:</td>
            <td style="padding: 8px 0; color: #2C1810;">${email}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #2C1810;">חבילה:</td>
            <td style="padding: 8px 0; color: #FF6B35; font-weight: bold;">${planLabel}</td>
          </tr>
          ${message ? `
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #2C1810; vertical-align: top;">הודעה:</td>
            <td style="padding: 8px 0; color: #2C1810;">${message.replace(/\n/g, '<br>')}</td>
          </tr>` : ''}
        </table>
        <p style="margin-top: 24px; color: #999; font-size: 12px;">
          הודעה זו נשלחה מטופס יצירת קשר באתר ארוחת 10
        </p>
      </div>
    `

    await resend.emails.send({
      from: 'ארוחת 10 <onboarding@resend.dev>',
      to: 'mytenmeal@gmail.com',
      subject: `פנייה חדשה מ-${name}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json({ error: 'שגיאה בשליחת ההודעה' }, { status: 500 })
  }
}
