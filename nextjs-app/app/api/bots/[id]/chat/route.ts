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

    // Check if bot is public or owner
    if (!bot.public) {
      console.log('Private bot access - owner check not implemented yet')
    }

    // ============================================
    // RAG IMPLEMENTATION - KNOWLEDGE BASE SEARCH
    // ============================================

    // Get the last user message (the current question)
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    let contextChunks: string[] = []
    let foundContext = false

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
              match_threshold: 0.75, // Lowered threshold to catch more results
              match_count: 8, // Increased to get more context
              bot_id_filter: botId
            })

          if (!searchError && chunks && chunks.length > 0) {
            contextChunks = chunks.map((chunk: any) => chunk.content)
            foundContext = true
            console.log(`✅ Found ${chunks.length} relevant chunks from knowledge base`)
          } else {
            console.log('⚠️ No relevant chunks found in knowledge base')
          }
        }
      } catch (embeddingError) {
        console.error('❌ Error generating embedding or searching chunks:', embeddingError)
      }
    }

    // Step 3: Build STRICT system prompt that prioritizes knowledge base
    let enhancedSystemPrompt = bot.prompt || 'You are a helpful assistant.'

    if (foundContext && contextChunks.length > 0) {
      const contextText = contextChunks.join('\n\n---\n\n')
      
      // STRICT prompt that forces the bot to use KB first
      enhancedSystemPrompt = `${bot.prompt || 'You are a helpful assistant.'}

═══════════════════════════════════════════════════════════════
🔒 CRITICAL INSTRUCTION - KNOWLEDGE BASE PRIORITY 🔒
═══════════════════════════════════════════════════════════════

You MUST follow these rules in STRICT order:

1. **ALWAYS search the KNOWLEDGE BASE FIRST** before using any other information
2. **IF the answer exists in the knowledge base below, you MUST use it** - do NOT use your training data
3. **ONLY use your general knowledge if the knowledge base has NO relevant information**
4. **When using knowledge base**: Be direct and confident - do not say "according to the knowledge base"
5. **When NO knowledge base info**: Clearly state "I don't have specific information about this in my knowledge base, but based on general knowledge..."

═══════════════════════════════════════════════════════════════
📚 KNOWLEDGE BASE CONTEXT (Use this FIRST):
═══════════════════════════════════════════════════════════════

${contextText}

═══════════════════════════════════════════════════════════════

Now answer the user's question using the knowledge base above as your PRIMARY source.`
    } else {
      // No knowledge base context found
      enhancedSystemPrompt = `${bot.prompt || 'You are a helpful assistant.'}

⚠️ IMPORTANT: I do not currently have any specific knowledge base information that answers this question. 

You should respond with: "I don't have specific information about this in my knowledge base yet. [Then provide a helpful general answer if appropriate, or suggest they upload relevant documents to teach me about this topic.]"`
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
