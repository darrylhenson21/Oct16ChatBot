"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Settings, Trash2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Bot {
  id: string
  name: string
  status: string
  domain_count?: number
  source_count?: number
  updated_at: string
}

const MAX_BOTS = 10

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null)
  const [newBotName, setNewBotName] = useState("")
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    loadBots()
    
    // Auto-refresh every 10 seconds to catch status updates
    const interval = setInterval(() => {
      loadBots(true) // silent refresh
    }, 10000)
    
    return () => clearInterval(interval)
  }, [])

  const loadBots = async (silent = false) => {
    try {
      if (!silent) {
        setRefreshing(true)
      }
      console.log('Loading bots...')
      const response = await fetch("/api/bots", {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Bots loaded:', data)
        setBots(data)
      } else {
        console.error('Failed to load bots:', response.status)
      }
    } catch (error) {
      console.error("Failed to load bots:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const createBot = async () => {
    if (!newBotName.trim()) return

    setCreating(true)
    try {
      const response = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBotName }),
      })

      if (response.ok) {
        const bot = await response.json()
        console.log('Bot created:', bot)
        toast({ title: "Bot created successfully" })
        setShowCreateDialog(false)
        setNewBotName("")
        await loadBots()
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to create bot",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Create bot error:', error)
      toast({
        title: "Error",
        description: "Failed to create bot",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const deleteBot = async (botId: string) => {
    console.log('Attempting to delete bot:', botId)
    setDeleting(botId)
    try {
      const response = await fetch(`/api/bots/${botId}`, {
        method: "DELETE",
      })

      console.log('Delete response status:', response.status)
      console.log('Delete response ok:', response.ok)

      if (response.ok) {
        const result = await response.json()
        console.log('Delete result:', result)
        
        toast({ title: "Bot deleted successfully" })
        setShowDeleteDialog(null)
        
        // Immediately remove from UI for instant feedback
        setBots(prevBots => {
          const filtered = prevBots.filter(bot => bot.id !== botId)
          console.log('Bots after filter:', filtered)
          return filtered
        })
        
        // Double-check with server after a short delay
        setTimeout(() => loadBots(true), 500)
      } else {
        const errorData = await response.json()
        console.error('Delete failed:', errorData)
        toast({
          title: "Error",
          description: errorData.error || "Failed to delete bot",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Delete bot error:', error)
      toast({
        title: "Error",
        description: "Failed to delete bot",
        variant: "destructive",
      })
    } finally {
      setDeleting(null)
    }
  }

  const getStatusColor = (status: string) => {
    if (!status) return "bg-gray-100 text-gray-800"
    
    switch (status) {
      case "ready":
        return "bg-green-100 text-green-800"
      case "needs_source":
        return "bg-yellow-100 text-yellow-800"
      case "processing":
        return "bg-blue-100 text-blue-800"
      case "error":
        return "bg-red-100 text-red-800"
      case "disabled":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatStatus = (status: string) => {
    if (!status) return "Unknown"
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  }

  const canCreateMore = bots.length < MAX_BOTS

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading bots...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Your Bots</h1>
          <p className="text-slate-500 mt-1">
            You can create up to {MAX_BOTS} bots ({bots.length}/{MAX_BOTS})
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => loadBots()} 
            variant="outline" 
            size="lg"
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canCreateMore && (
            <Button onClick={() => setShowCreateDialog(true)} data-testid="create-bot-button">
              <Plus className="mr-2 h-4 w-4" />
              Create Bot
            </Button>
          )}
        </div>
      </div>

      {/* Warning when limit reached */}
      {!canCreateMore && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 text-sm">
            ⚠️ You've reached the maximum limit of {MAX_BOTS} bots. Delete a bot to create a new one.
          </p>
        </div>
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create New Bot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bot-name">Bot Name</Label>
                <Input
                  id="bot-name"
                  value={newBotName}
                  onChange={(e) => setNewBotName(e.target.value)}
                  placeholder="e.g., Support Bot"
                  autoFocus
                  data-testid="bot-name-input"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={createBot}
                  disabled={creating || !newBotName.trim()}
                  className="flex-1"
                  data-testid="confirm-create-bot"
                >
                  {creating ? "Creating..." : "Create"}
                </Button>
                <Button
                  onClick={() => {
                    setShowCreateDialog(false)
                    setNewBotName("")
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Delete Bot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete this bot? This action cannot be undone and will remove all associated data, including sources and chat history.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => deleteBot(showDeleteDialog)}
                  disabled={deleting === showDeleteDialog}
                  variant="destructive"
                  className="flex-1"
                  data-testid="confirm-delete-bot"
                >
                  {deleting === showDeleteDialog ? "Deleting..." : "Delete"}
                </Button>
                <Button
                  onClick={() => setShowDeleteDialog(null)}
                  variant="outline"
                  className="flex-1"
                  disabled={deleting === showDeleteDialog}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bots Grid */}
      {bots.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg text-slate-600 mb-4">Let's build your first bot</p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Bot
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {bots.map((bot) => (
            <Card key={bot.id} className="hover:shadow-lg transition-shadow relative" data-testid={`bot-card-${bot.id}`}>
              {/* Delete button in top right - FIXED VERSION */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('Delete button clicked for bot:', bot.id)
                  setShowDeleteDialog(bot.id)
                }}
                className="absolute top-3 right-3 p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors z-10"
                title="Delete bot"
                data-testid={`delete-bot-${bot.id}`}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <CardHeader>
                <div className="flex items-start justify-between pr-8">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{bot.name || 'Unnamed Bot'}</CardTitle>
                    <span
                      className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${getStatusColor(
                        bot.status
                      )}`}
                    >
                      {formatStatus(bot.status)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-slate-600 mb-4">
                  <div>Domains: {bot.domain_count || 0}/10</div>
                  <div>Sources: {bot.source_count || 0}/2</div>
                </div>
                <Button
                  onClick={() => router.push(`/bots/${bot.id}`)}
                  className="w-full"
                  size="sm"
                  data-testid={`edit-bot-${bot.id}`}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Empty slots */}
          {Array.from({ length: MAX_BOTS - bots.length }).map((_, i) => (
            <Card key={`empty-${i}`} className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center h-48">
                <Plus className="h-12 w-12 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">Empty slot</p>
                {canCreateMore && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowCreateDialog(true)}
                  >
                    Create bot
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
