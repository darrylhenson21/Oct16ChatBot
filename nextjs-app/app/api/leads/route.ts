import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's bots first
    const botsResult = await query(
      'SELECT id FROM bots WHERE user_id = $1',
      [session.accountId]  // Changed from session.user.id
    )

    if (botsResult.rows.length === 0) {
      return NextResponse.json({ leads: [] })
    }

    const botIds = botsResult.rows.map(bot => bot.id)

    // Get leads for user's bots with bot names
    const leadsResult = await query(
      `SELECT 
        leads.id,
        leads.bot_id,
        leads.name,
        leads.email,
        leads.session_id,
        leads.status,
        leads.sent_at,
        leads.attempts,
        leads.created_at,
        bots.name as bot_name
      FROM leads
      LEFT JOIN bots ON leads.bot_id = bots.id
      WHERE leads.bot_id = ANY($1)
      ORDER BY leads.created_at DESC`,
      [botIds]
    )

    return NextResponse.json({
      leads: leadsResult.rows,
      total: leadsResult.rows.length,
    })
  } catch (error) {
    console.error('Failed to fetch leads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}
