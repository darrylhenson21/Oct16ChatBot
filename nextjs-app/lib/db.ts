import { createClient } from '@supabase/supabase-js'

// Supabase client
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

// Simple query wrapper using Supabase methods
export const query = async (text: string, params?: any[]) => {
  console.log('Query:', text, 'Params:', params)
  
  try {
    // Handle COUNT queries
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
    
    // Handle SELECT from bots
    if (text.includes('FROM bots') && text.includes('SELECT')) {
      const { data, error } = await supabase.from('bots').select('*')
      if (error) throw error
      return { rows: data || [], rowCount: data?.length || 0 }
    }
    
    // Handle INSERT INTO bots - FIXED VERSION
    if (text.includes('INSERT INTO bots')) {
      const [accountId, name, greeting, systemPrompt, model, temperature, topP, maxTokens, primaryColor, textColor, backgroundColor] = params || []
      
      const { data, error } = await supabase
        .from('bots')
        .insert({
          account_id: accountId,
          name: name,
          greeting: greeting || 'Hi! How can I help you today?',
          prompt: systemPrompt || 'You are a helpful assistant.',
          model: model || 'gpt-4o-mini',
          temperature: temperature || 0.7,
          top_p: topP || 1.0,
          max_tokens: maxTokens || 512,
          primary_color: primaryColor || '#0ea5e9',
          text_color: textColor || '#ffffff',
          background_color: backgroundColor || '#1e293b',
          status: 'needs_source',
          public: true
        })
        .select()
        .single()
      
      if (error) {
        console.error('Insert error:', error)
        throw error
      }
      
      console.log('Bot created:', data)
      return { rows: [data], rowCount: 1 }
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
