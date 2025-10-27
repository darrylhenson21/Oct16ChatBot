import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's bots
    const botsResult = await query(
      'SELECT id, name FROM bots WHERE account_id = $1',
      [session.accountId]
    )

    if (botsResult.rows.length === 0) {
      return NextResponse.json({ analytics: [] })
    }

    const bots = botsResult.rows
    const botIds = bots.map(bot => bot.id)

    // Get analytics for each bot
    const analyticsResult = await query(
      `SELECT 
        bot_id,
        COUNT(*) as total_messages,
        COUNT(DISTINCT session_id) as conversations,
        MAX(created_at) as last_active
      FROM messages
      WHERE bot_id = ANY($1)
      GROUP BY bot_id`,
      [botIds]
    )

    // Map bot names to analytics
    const botMap = bots.reduce((acc, bot) => {
      acc[bot.id] = bot.name
      return acc
    }, {} as Record<string, string>)

    const analytics = analyticsResult.rows.map(row => ({
      bot_id: row.bot_id,
      bot_name: botMap[row.bot_id] || 'Unknown Bot',
      total_messages: parseInt(row.total_messages) || 0,
      conversations: parseInt(row.conversations) || 0,
      last_active: row.last_active || null,
    }))

    // Include bots with no messages
    const botsWithData = new Set(analytics.map(a => a.bot_id))
    bots.forEach(bot => {
      if (!botsWithData.has(bot.id)) {
        analytics.push({
          bot_id: bot.id,
          bot_name: bot.name,
          total_messages: 0,
          conversations: 0,
          last_active: null,
        })
      }
    })

    // Sort by total messages descending
    analytics.sort((a, b) => b.total_messages - a.total_messages)

    return NextResponse.json({ analytics })
  } catch (error) {
    console.error('Failed to fetch analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
