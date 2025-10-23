// nextjs-app/app/api/bots/[id]/chat/route.ts
// Why: Ensure KB is actually used; never silently skip retrieval.

import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { supabaseAdmin } from '@/lib/supabaseServer'
import { z } from 'zod'
import { detectEmail } from '@/lib/lead-detector'
import { sendLeadNotification } from '@/lib/email'

const Body = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().min(1).max(4000),
    })
  ).min(1),
})

function cosineSim(a: number[], b: number[]) {
  // Why: Fallback ranking when RPC is missing/empty.
  let dot = 0, na = 0, nb = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1
  return dot / denom
}

const THRESHOLD = 0.70      // recall first; adjust later
const TOP_K = 8

// Helper function to save message to database
async function saveMessage(
  botId: string,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
) {
  try {
    const { error } = await supabaseAdmin()
      .from('messages')
      .insert({
        bot_id: botId,
        session_id: sessionId,
        role,
        content,
        created_at: new Date().toISOString(),
      })
    
    if (error) {
      console.error('Failed to save message:', error)
    }
  } catch (err) {
    console.error('Error saving message:', err)
  }
}

// Helper function to capture lead
async function captureLead(
  botId: string,
  botName: string,
  email: string,
  sessionId: string
) {
  try {
    const supabase = supabaseAdmin()
    
    // Check if lead already exists for this bot
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('bot_id', botId)
      .eq('email', email)
      .single()

    if (existingLead) {
      console.log('Lead already exists:', email)
      return { alreadyExists: true }
    }

    // Insert new lead
    const { data: newLead, error: insertError } = await supabase
      .from('leads')
      .insert({
        bot_id: botId,
        email,
        session_id: sessionId,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to insert lead:', insertError)
      return { error: insertError }
    }

    const leadId = newLead.id

    // Send email notification
    try {
      await sendLeadNotification({
        email,
        botName,
        sessionId,
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

      console.log('✅ Lead captured and notification sent:', email)
      return { success: true, leadId }
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

      console.error('❌ Failed to send lead notification:', emailError)
      return { error: emailError }
    }
  } catch (error) {
    console.error('Failed to capture lead:', error)
    return { error }
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response('Server misconfigured: OPENAI_API_KEY missing', { status: 500 })
    }

    const parse = Body.safeParse(await req.json())
    if (!parse.success) return new Response('Invalid request body', { status: 400 })
    const { messages } = parse.data

    const botId = params.id
    const { data: bot, error: botErr } = await supabaseAdmin()
      .from('bots').select('*').eq('id', botId).single()

    if (botErr || !bot) return new Response('Bot not found', { status: 404 })
    if (!bot.public) {
      // TODO: verify owner/session
      console.log('Private bot access - owner check not implemented yet')
    }

    // ==== SAVE USER MESSAGE & DETECT LEADS ====
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    if (lastUserMessage) {
      // Generate session ID (you can improve this with actual session tracking)
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`
      
      // Save message to database
      await saveMessage(botId, sessionId, 'user', lastUserMessage.content)
      
      // Detect and capture leads (async, don't block chat response)
      const detectedEmail = detectEmail(lastUserMessage.content)
      if (detectedEmail) {
        console.log('📧 Email detected in message:', detectedEmail)
        
        // Capture lead asynchronously (don't block chat response)
        captureLead(
          botId,
          bot.name || 'Chatbot',
          detectedEmail,
          sessionId
        ).catch(err => console.error('Lead capture error:', err))
      }
    }

    // ==== RAG ====
    let contextChunks: string[] = []
    let foundContext = false

    if (lastUserMessage) {
      // 1) embed query
      const embRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: lastUserMessage.content }),
      })
      if (!embRes.ok) {
        console.error('Embedding HTTP error:', embRes.status, await embRes.text())
      } else {
        const { data } = await embRes.json() as { data: { embedding: number[] }[] }
        const queryEmbedding = data?.[0]?.embedding

        // 2) primary: RPC match_chunks
        let rpcWorked = false
        try {
          const { data: chunks, error } = await supabaseAdmin().rpc('match_chunks', {
            query_embedding: queryEmbedding,
            match_threshold: THRESHOLD,
            match_count: TOP_K,
            bot_id_filter: botId,
          })

          if (error) {
            console.warn('match_chunks RPC error:', error)
          } else if (chunks?.length) {
            contextChunks = chunks.map((c: any) => c.content)
            foundContext = true
            rpcWorked = true
            console.log(`KB: RPC returned ${chunks.length} chunks`)
          }
        } catch (e) {
          console.warn('match_chunks RPC threw:', e)
        }

        // 3) fallback: client-side cosine ranking
        if (!rpcWorked) {
          const { data: rows, error } = await supabaseAdmin()
            .from('chunks')
            .select('id, content, embedding, bot_id')
            .eq('bot_id', botId)
            .limit(200)  // safety cap
          if (error) {
            console.warn('Fallback chunks select error:', error)
          } else if (rows?.length) {
            const ranked = rows
              .map((r: any) => ({ content: r.content, sim: cosineSim(queryEmbedding, r.embedding as number[]) }))
              .sort((a, b) => b.sim - a.sim)
              .filter(x => x.sim >= THRESHOLD)
              .slice(0, TOP_K)
            if (ranked.length) {
              contextChunks = ranked.map(x => x.content)
              foundContext = true
              console.log(`KB: Fallback ranked ${ranked.length} chunks`)
            } else {
              console.log('KB: Fallback found no chunks above threshold')
            }
          } else {
            console.log('KB: No chunks exist for this bot')
          }
        }
      }
    }

    // 4) system prompt
    let systemPrompt: string
    if (foundContext && contextChunks.length) {
      const contextText = contextChunks.join('\n\n---\n\n')
      systemPrompt = `${bot.prompt || 'You are a helpful assistant.'}

═══════════════════════════════════════════════════════════════
🔒 CRITICAL INSTRUCTION - KNOWLEDGE BASE PRIORITY 🔒
═══════════════════════════════════════════════════════════════
1) ALWAYS search the KNOWLEDGE BASE FIRST.
2) If the answer exists in the knowledge base below, USE IT. Do NOT rely on general training.
3) Only use general knowledge if the knowledge base has NO relevant information.
4) When using the knowledge base: be direct and confident.
5) If NO knowledge base info is relevant: clearly say so.

📚 KNOWLEDGE BASE CONTEXT (use first):
${contextText}
`
    } else {
      systemPrompt = `${bot.prompt || 'You are a helpful assistant.'}

⚠️ I do not currently have knowledge-base context for this question.
Say: "I don't have specific information about this in my knowledge base yet." 
Then optionally provide general guidance or suggest uploading relevant docs.`
    }

    // 5) stream
    const result = streamText({
      model: openai(bot.model || 'gpt-4o-mini'),
      temperature: bot.temperature ?? 0.5,
      system: systemPrompt,
      messages,
    })
    return result.toDataStreamResponse()
  } catch (err) {
    console.error('Chat API error:', err)
    return new Response('Internal server error', { status: 500 })
  }
}
