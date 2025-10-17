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
  console.log('Query:', text, 'Params:', params)
  
  try {
    // Handle COUNT queries for bots
    if (text.includes('COUNT(*)') && text.includes('FROM bots')) {
      const accountId = params?.[0]
      const { count, error } = await supabase
        .from('bots')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId)
      
      if (error) throw error
      return { rows: [{ count: count || 0 }], rowCount: 1 }
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
    
    // Handle complex SELECT from bots with joins
    if (text.includes('FROM bots b') && text.includes('domain_count')) {
      const accountId = params?.[0]
      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      // Add domain_count and source_count as 0 for now
      const botsWithCounts = (data || []).map(bot => ({
        ...bot,
        domain_count: 0,
        source_count: 0
      }))
      
      return { rows: botsWithCounts, rowCount: botsWithCounts.length }
    }
    
    // Handle simple SELECT from bots
    if (text.includes('FROM bots') && text.includes('SELECT')) {
      const { data, error } = await supabase.from('bots').select('*')
      if (error) throw error
      return { rows: data || [], rowCount: data?.length || 0 }
    }
    
    // Handle INSERT INTO bots
    if (text.includes('INSERT INTO bots')) {
      // Simple insert from POST route - only account_id and name
      if (text.includes('RETURNING *') && params?.length === 2) {
        const [accountId, name] = params
        
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
      return { rows: [], rowCount: 1 }
    }
    
    // Default return
    console.log('Unhandled query type:', text.substring(0, 50))
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
