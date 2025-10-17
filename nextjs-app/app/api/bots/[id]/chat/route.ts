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

    // Stream response from OpenAI
    const result = streamText({
      model: openai(bot.model || 'gpt-4o-mini'),
      temperature: bot.temperature || 0.5,
      system: bot.prompt || 'You are a helpful assistant.',
      messages,
    })

    // Return streaming response
    return result.toDataStreamResponse()
  } catch (error: any) {
    console.error('Chat API error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
