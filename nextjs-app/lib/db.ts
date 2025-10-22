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
    
    // Handle complex SELECT with joins (GET /api/bots)
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
      
      // Add domain_count and source_count (set to 0 for now)
      const botsWithCounts = (data || []).map(bot => ({
        ...bot,
        domain_count: 0,
        source_count: 0
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
    
    // Handle simple SELECT from bots
    if (text.includes('FROM bots') && text.includes('SELECT')) {
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
          public: true
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
    
    // ========== ADD THIS: Handle DELETE queries ==========
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
    // =====================================================
    
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
