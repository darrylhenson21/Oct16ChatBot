import { supabaseAnon } from '@/lib/supabaseServer'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import UnifiedBotPage from './UnifiedBotPage'

export const dynamic = 'force-dynamic'

export default async function BotDetailPage({ params }: { params: { id: string } }) {
  const { data: bot, error } = await supabaseAnon()
    .from('bots')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !bot) {
    notFound()
  }

  async function save(formData: FormData) {
    'use server'
    
    const payload = {
      name: formData.get('name') as string,
      prompt: formData.get('prompt') as string,
      model: formData.get('model') as string,
      temperature: parseFloat(formData.get('temperature') as string),
      public: formData.get('public') === 'on',
      require_prechat: formData.get('require_prechat') === 'on',  // ADD THIS LINE
    }

    const { error } = await supabaseAnon()
      .from('bots')
      .update(payload)
      .eq('id', params.id)

    if (error) {
      console.error('Save error:', error)
      throw new Error('Failed to save bot')
    }

    revalidatePath(`/bots/${params.id}`)
    redirect(`/bots/${params.id}`)
  }

  const embedSnippet = `<script src="${process.env.NEXT_PUBLIC_APP_URL}/widget.js" data-bot-id="${bot.id}" data-title="${bot.name}" defer></script>`

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900" data-testid="bot-name-heading">
          {bot.name}
        </h1>
        <p className="text-slate-500 mt-1">Configure your chatbot settings</p>
      </div>

      <UnifiedBotPage bot={bot} save={save} embedSnippet={embedSnippet} />
    </div>
  )
}
