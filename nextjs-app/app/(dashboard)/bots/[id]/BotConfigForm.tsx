'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

interface Bot {
  id: string
  name: string
  prompt: string
  model: string
  temperature: number
  public: boolean
}

export default function BotConfigForm({
  bot,
  save,
  embedSnippet,
}: {
  bot: Bot
  save: (formData: FormData) => Promise<void>
  embedSnippet: string
}) {
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      const formData = new FormData(e.currentTarget)
      await save(formData)
      toast({ title: 'Bot saved successfully!' })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save bot',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedSnippet)
    setCopied(true)
    toast({ title: 'Embed code copied!' })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex gap-4 border-b">
        <Link
          href={`/bots/${bot.id}`}
          className="pb-3 px-4 border-b-2 border-primary font-medium text-primary"
        >
          Configuration
        </Link>
        <Link
          href={`/bots/${bot.id}/chat`}
          className="pb-3 px-4 border-b-2 border-transparent font-medium text-slate-600 hover:text-slate-900"
        >
          Test Chat
        </Link>
      </div>

      {/* Bot Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Bot Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Bot Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={bot.name}
              required
              data-testid="bot-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt">System Prompt</Label>
            <textarea
              id="prompt"
              name="prompt"
              defaultValue={bot.prompt}
              required
              rows={6}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="You are a helpful assistant..."
              data-testid="bot-prompt-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <select
                id="model"
                name="model"
                defaultValue={bot.model}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-testid="bot-model-select"
              >
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="gpt-4o">gpt-4o</option>
                <option value="gpt-4-turbo">gpt-4-turbo</option>
                <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature</Label>
              <Input
                id="temperature"
                name="temperature"
                type="number"
                min="0"
                max="2"
                step="0.1"
                defaultValue={bot.temperature}
                required
                data-testid="bot-temperature-input"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="public"
              name="public"
              value="true"
              defaultChecked={bot.public}
              className="h-4 w-4 rounded border-gray-300"
              data-testid="bot-public-checkbox"
            />
            <Label htmlFor="public" className="font-normal">
              Make this bot publicly accessible (anyone can chat with it)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Embed Code */}
      <Card>
        <CardHeader>
          <CardTitle>Embed Code</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">
            Add this code to any website to embed your chatbot:
          </p>
          <div className="relative">
            <pre className="bg-slate-50 p-4 rounded-md text-sm overflow-x-auto border">
              <code>{embedSnippet}</code>
            </pre>
            <Button
              type="button"
              onClick={copyEmbed}
              size="sm"
              variant="outline"
              className="absolute top-2 right-2"
              data-testid="copy-embed-button"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving} size="lg" data-testid="save-bot-button">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
