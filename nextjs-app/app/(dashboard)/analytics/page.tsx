'use client'

import { useEffect, useState } from 'react'
import { BarChart3, MessageSquare, Users, Clock } from 'lucide-react'

interface BotAnalytics {
  bot_id: string
  bot_name: string
  total_messages: number
  conversations: number
  last_active: string | null
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<BotAnalytics[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  async function fetchAnalytics() {
    try {
      const response = await fetch('/api/analytics')
      const data = await response.json()
      setAnalytics(data.analytics || [])
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-8 h-8" />
          Analytics
        </h1>
        <p className="text-slate-500 mt-1">
          View chat metrics for all your bots
        </p>
      </div>

      {analytics.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            No analytics data yet
          </h3>
          <p className="text-slate-500">
            Analytics will appear here once your bots start receiving messages.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Bot Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Total Messages
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Conversations
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Last Active
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {analytics.map((bot) => (
                <tr key={bot.bot_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{bot.bot_name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-700 font-semibold">
                      {bot.total_messages.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-700 font-semibold">
                      {bot.conversations.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-500 text-sm">
                      {formatDate(bot.last_active)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-sm text-slate-500">
        Total bots: {analytics.length}
      </div>
    </div>
  )
}
