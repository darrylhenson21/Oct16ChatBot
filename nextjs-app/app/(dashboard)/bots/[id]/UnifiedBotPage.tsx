'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Check, Upload, Loader2, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Bot {
  id: string
  name: string
  prompt: string
  model: string
  temperature: number
  public: boolean
  require_prechat?: boolean
}

interface Source {
  id: string
  name: string
  type: string
  status: string
  chunk_count: number
}

export default function UnifiedBotPage({
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
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [input, setInput] = useState('')
  const [chatting, setChatting] = useState(false)
  const [deletingSource, setDeletingSource] = useState<string | null>(null)
  const { toast } = useToast()

  // Load sources
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
        await loadSources()
        setTimeout(() => loadSources(), 2000)
        setTimeout(() => loadSources(), 5000)
      } else {
        const data = await response.json()
        toast({ title: 'Error', description: data.error || 'Upload failed', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Upload failed', variant: 'destructive' })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteSource = async (sourceId: string) => {
    if (!confirm('Are you sure you want to delete this source? This will remove all associated knowledge from your bot.')) {
      return
    }

    setDeletingSource(sourceId)
    try {
      const response = await fetch(`/api/bots/${bot.id}/sources?sourceId=${sourceId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({ title: 'Source deleted successfully' })
        loadSources()
      } else {
        const data = await response.json()
        toast({ title: 'Error', description: data.error || 'Failed to delete source', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete source', variant: 'destructive' })
    } finally {
      setDeletingSource(null)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || chatting) return

    const userMessage = input.trim()
    setInput('')
    const newUserMessage = { role: 'user', content: userMessage }
    const updatedMessages = [...messages, newUserMessage]
    setMessages(updatedMessages)
    setChatting(true)

    try {
      const response = await fetch(`/api/bots/${bot.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: updatedMessages
        }),
      })

      if (!response.ok) {
        toast({ title: 'Error', description: 'Failed to get response', variant: 'destructive' })
        setChatting(false)
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      if (reader) {
        setMessages(prev => [...prev, { role: 'assistant', content: '' }])
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (line.startsWith('0:')) {
              const text = line.slice(2).replace(/^"|"$/g, '')
              assistantMessage += text
              setMessages(prev => {
                const newMessages = [...prev]
                newMessages[newMessages.length - 1].content = assistantMessage
                return newMessages
              })
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      toast({ title: 'Error', description: 'Failed to get response', variant: 'destructive' })
    } finally {
      setChatting(false)
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

  // Helper function to format message content - FIXED VERSION
  const formatContent = (content: string) => {
    return content
      .replace(/\\n/g, '\n')           // Convert escaped newlines to actual newlines
      .replace(/\\"/g, '"')            // Remove escaped double quotes
      .replace(/\\'/g, "'")            // Remove escaped single quotes
      .replace(/\*\*\*/g, '')          // Remove *** (bold+italic markdown)
      .replace(/\*\*/g, '')            // Remove ** (bold markdown)
      .replace(/\*/g, '')              // Remove * (italic markdown)
      .trim()
  }

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex gap-4 border-b">
        <button
          type="button"
          onClick={() => handleTabChange('configuration')}
          className={`pb-3 px-4 border-b-2 font-medium transition-colors ${
            activeTab === 'configuration'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Configuration
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('knowledge')}
          className={`pb-3 px-4 border-b-2 font-medium transition-colors ${
            activeTab === 'knowledge'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Knowledge Base
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('chat')}
          className={`pb-3 px-4 border-b-2 font-medium transition-colors ${
            activeTab === 'chat'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Test Chat
        </button>
      </div>

      {/* Configuration Tab */}
      {activeTab === 'configuration' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bot Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Bot Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Enter bot name"
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
                  rows={6}
                  className="w-full px-3 py-2 border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter system instructions for your bot..."
                  defaultValue={bot.prompt}
                  required
                  data-testid="bot-prompt-textarea"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <select
                    id="model"
                    name="model"
                    className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    defaultValue={bot.model}
                    required
                    data-testid="bot-model-select"
                  >
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature</Label>
                  <Input
                    id="temperature"
                    name="temperature"
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    placeholder="0.7"
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

              {/* NEW: Pre-chat Form Toggle */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id="require_prechat"
                    name="require_prechat"
                    defaultChecked={bot.require_prechat || false}
                    className="h-4 w-4 rounded border-gray-300 mt-1"
                    data-testid="bot-require-prechat-checkbox"
                  />
                  <div className="flex-1">
                    <Label htmlFor="require_prechat" className="font-medium">
                      Require name & email before chat
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Show a form asking for visitor's name and email before starting the chat. This helps capture leads upfront.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
                <input
                  type="file"
                  accept=".pdf,.txt,.docx"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={(e) => {
                      e.preventDefault()
                      document.getElementById('file-upload')?.click()
                    }}
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
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{source.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {source.chunk_count} chunks • {source.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`px-3 py-1 rounded-full text-xs ${
                          source.status === 'completed' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {source.status}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSource(source.id)}
                          disabled={deletingSource === source.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {deletingSource === source.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Test Chat Tab */}
      {activeTab === 'chat' && (
        <Card className="h-[600px] flex flex-col">
          <CardHeader>
            <CardTitle>Test Your Bot</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-4">
            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 mb-4 p-4 border rounded-lg">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Start a conversation to test your bot
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 break-words ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere">
                        {formatContent(msg.content)}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {chatting && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Type your message..."
                disabled={chatting}
              />
              <Button onClick={sendMessage} disabled={chatting || !input.trim()}>
                {chatting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
