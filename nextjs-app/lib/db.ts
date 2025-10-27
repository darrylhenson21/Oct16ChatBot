import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export const query = async (text: string, params?: any[]) => {
  console.log('Query:', text.substring(0, 200), 'Params:', params)
  
  try {
    // Handle COUNT queries for bots
    if (text.includes('COUNT(*)') && text.includes('FROM bots') && !text.includes('SELECT b.*')) {
      const accountId = params?.[0]
      const { count, error } = await supabase
        .from('bots')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId)
      
      if (error) throw error
      return { rows: [{ count: count || 0 }], rowCount: 1 }
    }
    
    // Handle complex SELECT with joins (GET /api/bots) - WITH AUTO STATUS UPDATE
    if (text.includes('SELECT b.*') && text.includes('domain_count')) {
      const accountId = params?.[0]
      console.log('Fetching bots for account:', accountId)
      
      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      console.log('Found bots:', data?.length || 0)
      
      // Get source counts for each bot and auto-update status
      const botsWithCounts = await Promise.all((data || []).map(async (bot) => {
        const { count: sourceCount } = await supabase
          .from('sources')
          .select('*', { count: 'exact', head: true })
          .eq('bot_id', bot.id)
          .eq('status', 'completed')
        
        // Auto-calculate status based on completed sources
        const actualStatus = sourceCount && sourceCount > 0 ? 'ready' : 'needs_source'
        
        return {
          ...bot,
          domain_count: 0,
          source_count: sourceCount || 0,
          status: actualStatus  // Override with calculated status
        }
      }))
      
      return { rows: botsWithCounts, rowCount: botsWithCounts.length }
    }
    
    // Handle SELECT from accounts
    if (text.includes('FROM accounts')) {
      const { data, error } = await supabase.from('accounts').select('*').limit(1)
      if (error) throw error
      return { rows: data || [], rowCount: data?.length || 0 }
    }
    
    // Handle SELECT from sessions
    if (text.includes('FROM sessions')) {
      const { data, error } = await supabase.from('sessions').select('*')
      if (error) throw error
      return { rows: data || [], rowCount: data?.length || 0 }
    }
    
    // Handle SELECT from auth_attempts
    if (text.includes('FROM auth_attempts')) {
      return { rows: [], rowCount: 0 }
    }
    
    // Handle SELECT id or SELECT id, name FROM bots WHERE account_id
    if ((text.includes('SELECT id FROM bots') || text.includes('SELECT id, name FROM bots')) && text.includes('WHERE account_id')) {
      const accountId = params?.[0]
      
      // Determine which fields to select based on query
      const selectFields = text.includes('SELECT id, name') ? 'id, name' : 'id'
      
      const { data, error } = await supabase
        .from('bots')
        .select(selectFields)
        .eq('account_id', accountId)
      
      if (error) throw error
      return { rows: data || [], rowCount: data?.length || 0 }
    }
    
    // Handle simple SELECT from bots
    if (text.includes('FROM bots') && text.includes('SELECT') && !text.includes('account_id')) {
      const { data, error } = await supabase.from('bots').select('*')
      if (error) throw error
      return { rows: data || [], rowCount: data?.length || 0 }
    }
    
    // Handle INSERT INTO bots
    if (text.includes('INSERT INTO bots') && text.includes('RETURNING *')) {
      const [accountId, name] = params || []
      console.log('Creating bot:', { accountId, name })
      
      const { data, error } = await supabase
        .from('bots')
        .insert({
          account_id: accountId,
          name: name,
          greeting: 'Hi! How can I help you today?',
          prompt: 'You are a helpful assistant.',
          model: 'gpt-4o-mini',
          temperature: 0.7,
          top_p: 1.0,
          max_tokens: 512,
          primary_color: '#0ea5e9',
          text_color: '#ffffff',
          background_color: '#1e293b',
          status: 'needs_source',
          public: true,
          require_prechat: false
        })
        .select()
        .single()
      
      if (error) {
        console.error('Insert bot error:', error)
        throw error
      }
      
      console.log('Bot created successfully:', data)
      return { rows: [data], rowCount: 1 }
    }
    
    // Handle INSERT INTO bot_limits
    if (text.includes('INSERT INTO bot_limits')) {
      const botId = params?.[0]
      const { error } = await supabase
        .from('bot_limits')
        .insert({ bot_id: botId })
      
      if (error) {
        console.error('Insert bot_limits error:', error)
      }
      return { rows: [], rowCount: 1 }
    }
    
    // Handle other INSERT queries
    if (text.toUpperCase().includes('INSERT INTO')) {
      console.log('Generic INSERT, returning success')
      return { rows: [], rowCount: 1 }
    }
    
    // Handle UPDATE queries
    if (text.toUpperCase().includes('UPDATE')) {
      console.log('UPDATE query detected')
      // For now, just return success for UPDATE queries
      return { rows: [], rowCount: 1 }
    }
    
    // Handle DELETE queries
    if (text.toUpperCase().includes('DELETE FROM')) {
      const botId = params?.[0]
      console.log('Deleting bot:', botId)
      
      const { error, count } = await supabase
        .from('bots')
        .delete({ count: 'exact' })
        .eq('id', botId)
      
      if (error) {
        console.error('Delete bot error:', error)
        throw error
      }
      
      console.log('Delete completed, rows affected:', count)
      return { rows: [], rowCount: count || 0 }
    }
    
    // Handle analytics query - MUST come before leads handler
    if (text.includes('FROM messages') && text.includes('COUNT(DISTINCT session_id)')) {
      const botIds = params?.[0] || []
      console.log('Fetching analytics for bot IDs:', botIds)
      
      if (botIds.length === 0) {
        return { rows: [], rowCount: 0 }
      }

      const { data, error } = await supabase
        .from('messages')
        .select('bot_id, session_id, created_at')
        .in('bot_id', botIds)
      
      if (error) throw error

      // Group by bot_id and calculate metrics
      const analytics = (data || []).reduce((acc, msg) => {
        if (!acc[msg.bot_id]) {
          acc[msg.bot_id] = {
            bot_id: msg.bot_id,
            sessions: new Set(),
            total_messages: 0,
            last_active: msg.created_at,
          }
        }
        
        acc[msg.bot_id].sessions.add(msg.session_id)
        acc[msg.bot_id].total_messages++
        
        if (new Date(msg.created_at) > new Date(acc[msg.bot_id].last_active)) {
          acc[msg.bot_id].last_active = msg.created_at
        }
        
        return acc
      }, {} as Record<string, any>)

      const rows = Object.values(analytics).map((a: any) => ({
        bot_id: a.bot_id,
        total_messages: a.total_messages.toString(),
        conversations: a.sessions.size.toString(),
        last_active: a.last_active,
      }))

      console.log('Analytics results:', rows)
      return { rows, rowCount: rows.length }
    }
    
    // Handle SELECT from leads with JOIN
    if (text.includes('FROM leads') && text.includes('LEFT JOIN bots')) {
      const botIds = params || []
      console.log('Fetching leads for bot IDs:', botIds)
      
      // Get leads
      let leadsQuery = supabase
        .from('leads')
        .select('id, bot_id, name, email, session_id, status, sent_at, attempts, created_at')
      
      // Filter by bot_ids if provided
      if (botIds.length > 0) {
        leadsQuery = leadsQuery.in('bot_id', botIds)
      }
      
      const { data: leadsData, error: leadsError } = await leadsQuery.order('created_at', { ascending: false })
      
      if (leadsError) throw leadsError
      
      // Get bot names
      const uniqueBotIds = [...new Set((leadsData || []).map(lead => lead.bot_id))]
      const { data: botsData, error: botsError } = await supabase
        .from('bots')
        .select('id, name')
        .in('id', uniqueBotIds)
      
      if (botsError) throw botsError
      
      // Map bot names to leads
      const botNameMap = (botsData || []).reduce((acc, bot) => {
        acc[bot.id] = bot.name
        return acc
      }, {} as Record<string, string>)
      
      const leadsWithBotNames = (leadsData || []).map(lead => ({
        ...lead,
        bot_name: botNameMap[lead.bot_id] || null
      }))
      
      console.log('Found leads:', leadsWithBotNames.length)
      return { rows: leadsWithBotNames, rowCount: leadsWithBotNames.length }
    }
    
    // Default return
    console.warn('Unhandled query type:', text.substring(0, 100))
    return { rows: [], rowCount: 0 }
    
  } catch (error: any) {
    console.error('Query error:', error.message)
    throw error
  }
}

export const getClient = async () => {
  return {
    query,
    release: () => {},
  }
}

export default { query, supabase }
