import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/leads - Fetch all leads or filter by bot
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const botId = searchParams.get('bot_id')

    let sql = `
      SELECT 
        l.id,
        l.bot_id,
        l.email,
        l.session_id,
        l.status,
        l.sent_at,
        l.attempts,
        l.last_error,
        l.created_at,
        b.name as bot_name
      FROM leads l
      LEFT JOIN bots b ON l.bot_id = b.bot_id
      WHERE 1=1
    `
    const params: any[] = []

    if (botId) {
      sql += ` AND l.bot_id = $1`
      params.push(botId)
    }

    sql += ` ORDER BY l.created_at DESC LIMIT 100`

    const result = await query(sql, params)

    return NextResponse.json({
      leads: result.rows,
      total: result.rows.length,
    })
  } catch (error) {
    console.error('Failed to fetch leads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}
