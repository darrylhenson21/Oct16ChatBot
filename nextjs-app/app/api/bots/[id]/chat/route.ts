import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { supabaseAdmin } from '@/lib/supabaseServer'
import { z } from 'zod'

const Body = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ),
})

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const botId = params.id
    const body = await req.json()
    
    // Validate request body
    const parsed = Body.safeParse(body)
    if (!parsed.success) {
      return new Response('Invalid request body', { status: 400 })
    }

    const { messages } = parsed.data

    // Guard: Reject if message too long
    for (const msg of messages) {
      if (msg.content.length > 4000) {
        return new Response('Message too long (max 4000 chars)', { status: 400 })
      }
    }

    // Fetch bot configuration from Supabase
    const { data: bot, error } = await supabaseAdmin()
      .from('bots')
      .select('*')
      .eq('id', botId)
      .single()

    if (error || !bot) {
      return new Response('Bot not found', { status: 404 })
    }

    // Check if bot is public or owner (TODO: implement owner check for private bots)
    if (!bot.public) {
      // TODO: Check if current user is the owner
      // For now, allow all requests to private bots
      console.log('Private bot access - owner check not implemented yet')
    }

    // ============================================
    // RAG IMPLEMENTATION - KNOWLEDGE BASE SEARCH
    // ============================================

    // Get the last user message (the current question)
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    let contextChunks: string[] = []

    if (lastUserMessage) {
      try {
        // Step 1: Generate embedding for the user's question
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: lastUserMessage.content,
          }),
        })

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json()
          const questionEmbedding = embeddingData.data[0].embedding

          // Step 2: Search for similar chunks in the knowledge base
          const { data: chunks, error: searchError } = await supabaseAdmin()
            .rpc('match_chunks', {
              query_embedding: questionEmbedding,
              match_threshold: 0.78,
              match_count: 5,
              bot_id_filter: botId
            })

          if (!searchError && chunks && chunks.length > 0) {
            contextChunks = chunks.map((chunk: any) => chunk.content)
            console.log(`Found ${chunks.length} relevant chunks for question`)
          } else {
            console.log('No relevant chunks found or search error:', searchError)
          }
        }
      } catch (embeddingError) {
        console.error('Error generating embedding or searching chunks:', embeddingError)
        // Continue without RAG context if there's an error
      }
    }

    // Step 3: Build enhanced system prompt with context
    let enhancedSystemPrompt = bot.prompt || 'You are a helpful assistant.'

    if (contextChunks.length > 0) {
      const contextText = contextChunks.join('\n\n---\n\n')
      enhancedSystemPrompt = `${bot.prompt || 'You are a helpful assistant.'}

IMPORTANT: Use the following context from the knowledge base to answer the user's question. If the answer is in the context, use it. If not, you can use your general knowledge but mention that the specific information isn't in the knowledge base.

CONTEXT FROM KNOWLEDGE BASE:
${contextText}

---

Now answer the user's question based on the above context when relevant.`
    }

    // ============================================
    // END RAG IMPLEMENTATION
    // ============================================

    // Stream response from OpenAI with enhanced prompt
    const result = streamText({
      model: openai(bot.model || 'gpt-4o-mini'),
      temperature: bot.temperature || 0.5,
      system: enhancedSystemPrompt,
      messages,
    })

    // Return streaming response
    return result.toDataStreamResponse()
  } catch (error: any) {
    console.error('Chat API error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
