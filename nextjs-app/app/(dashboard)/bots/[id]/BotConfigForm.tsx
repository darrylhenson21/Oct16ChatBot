'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Check, Upload, Loader2 } from 'lucide-react'
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

interface Source {
  id: string
  name: string
  type: string
  status: string
  chunk_count: number
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
  const [activeTab, setActiveTab] = useState('configuration')
  const [uploading, setUploading] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const { toast } = useToast()

  // Load sources when Knowledge Base tab is clicked
  const loadSources = async () => {
    try {
      const response = await fetch(`/api/bots/${bot.id}/sources`)
      if (response.ok) {
        const data = await response.json()
        setSources(data)
      }
    } catch (error) {
      console.error('Failed to load sources:', error)
    }
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    if (tab === 'knowledge') {
      loadSources()
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`/api/bots/${bot.id}/sources`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        toast({ title: 'File uploaded successfully! Processing...' })
        loadSources()
      } else {
        const data = await response.json()
        toast({ title: 'Error', description: data.error || 'Upload failed', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Upload failed', variant: 'destructive' })
    } finally {
      setUploading(false)
      // Reset file input
      e.target.value = ''
    }
  }

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
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex gap-4 border-b">
        <button
          type="button"
          onClick={() => handleTabChange('configuration')}
          className={`pb-3 px-4 border-b-2 font-medium ${
            activeTab === 'configuration'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Configuration
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('knowledge')}
          className={`pb-3 px-4 border-b-2 font-medium ${
            activeTab === 'knowledge'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Knowledge Base
        </button>
        <Link
          href={`/bots/${bot.id}/chat`}
          className="pb-3 px-4 border-b-2 border-transparent font-medium text-slate-600 hover:text-slate-900"
        >
          Test Chat
        </Link>
      </div>

      {/* Configuration Tab */}
      {activeTab === 'configuration' && (
        <form onSubmit={handleSubmit} className="space-y-6">
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
      )}

      {/* Knowledge Base Tab */}
      {activeTab === 'knowledge' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Upload PDF, TXT, or DOCX files to teach your bot
                </p>
                <div className="flex justify-center">
                  <label className="cursor-pointer">
                    <Input
                      type="file"
                      accept=".pdf,.txt,.docx"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploading}
                      onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Choose File
                        </>
                      )}
                    </Button>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Uploaded Sources ({sources.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {sources.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No sources uploaded yet. Upload documents above to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {source.chunk_count} chunks • {source.status}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs ${
                        source.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {source.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
