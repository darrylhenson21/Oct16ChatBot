import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export async function sendLeadNotification(lead: {
  email: string
  botName: string
  sessionId: string
  capturedAt: string
}) {
  const botOwnerEmail = process.env.BOT_OWNER_EMAIL

  if (!botOwnerEmail) {
    throw new Error('BOT_OWNER_EMAIL not configured')
  }

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: botOwnerEmail,
    subject: `🎯 New Lead Captured from ${lead.botName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0ea5e9;">New Lead Captured!</h2>
        <p>A new lead has been captured from your chatbot.</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 10px 0;"><strong>Bot Name:</strong> ${lead.botName}</p>
          <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:${lead.email}">${lead.email}</a></p>
          <p style="margin: 10px 0;"><strong>Session ID:</strong> ${lead.sessionId}</p>
          <p style="margin: 10px 0;"><strong>Captured At:</strong> ${lead.capturedAt}</p>
        </div>
        
        <p style="color: #64748b; font-size: 14px;">
          Log in to your dashboard to view more details and respond to this lead.
        </p>
      </div>
    `,
    text: `
New Lead Captured!

Bot Name: ${lead.botName}
Email: ${lead.email}
Session ID: ${lead.sessionId}
Captured At: ${lead.capturedAt}

Log in to your dashboard to view more details.
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
    return { success: true }
  } catch (error) {
    console.error('Failed to send email:', error)
    throw error
  }
}

// Test email configuration
export async function testEmailConfig() {
  try {
    await transporter.verify()
    return { success: true, message: 'Email configuration is valid' }
  } catch (error) {
    console.error('Email configuration error:', error)
    return { success: false, message: 'Email configuration failed', error }
  }
}
