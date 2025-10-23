import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseServer'
import { sendLeadNotification } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { bot_id, name, email, session_id } = body

    if (!bot_id || !email) {
      return NextResponse.json(
        { error: 'bot_id and email are required' },
        { status: 400 }
      )
    }

    const supabase = supabaseAdmin()

    // Get bot details
    const { data: bot } = await supabase
      .from('bots')
      .select('name')
      .eq('id', bot_id)
      .single()

    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      )
    }

    // Check if lead already exists
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('bot_id', bot_id)
      .eq('email', email)
      .single()

    if (existingLead) {
      return NextResponse.json({
        success: true,
        message: 'Lead already exists',
        lead_id: existingLead.id,
      })
    }

    // Insert new lead
    const { data: newLead, error: insertError } = await supabase
      .from('leads')
      .insert({
        bot_id,
        name: name || null,
        email,
        session_id: session_id || `session-${Date.now()}`,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to insert lead:', insertError)
      return NextResponse.json(
        { error: 'Failed to capture lead' },
        { status: 500 }
      )
    }

    const leadId = newLead.id

    // Send email notification
    try {
      await sendLeadNotification({
        email,
        botName: bot.name || 'Chatbot',
        sessionId: session_id || `session-${Date.now()}`,
        capturedAt: new Date().toLocaleString(),
      })

      // Mark as sent
      await supabase
        .from('leads')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          attempts: 1,
        })
        .eq('id', leadId)

      console.log('✅ Pre-chat lead captured and notification sent:', email)

      return NextResponse.json({
        success: true,
        lead_id: leadId,
        message: 'Lead captured successfully',
      })
    } catch (emailError) {
      // Mark as failed
      await supabase
        .from('leads')
        .update({
          status: 'failed',
          attempts: 1,
          last_error: String(emailError),
        })
        .eq('id', leadId)

      console.error('❌ Failed to send pre-chat lead notification:', emailError)

      return NextResponse.json({
        success: true,
        lead_id: leadId,
        message: 'Lead captured but email failed',
      })
    }
  } catch (error) {
    console.error('Lead capture API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
