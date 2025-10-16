'use client'

import { useChat } from 'ai/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Send, User, Bot } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function ChatPreviewPage() {
  const params = useParams()
  const botId = params.id as string

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: `/api/bots/${botId}/chat`,
  })

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Test Chat</h1>
        <p className="text-slate-500 mt-1">Preview how your bot responds</p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-4 border-b mb-6">
        <Link
          href={`/bots/${botId}`}
          className="pb-3 px-4 border-b-2 border-transparent font-medium text-slate-600 hover:text-slate-900"
        >
          Configuration
        </Link>
        <Link
          href={`/bots/${botId}/chat`}
          className="pb-3 px-4 border-b-2 border-primary font-medium text-primary"
        >
          Test Chat
        </Link>
      </div>

      {/* Chat Container */}
      <div className="flex flex-col h-[70vh] border rounded-lg bg-white shadow-sm">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="chat-messages">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-slate-400">
              <p>Start a conversation with your bot...</p>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
              data-testid={`message-${message.role}`}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-slate-100 rounded-lg px-4 py-2">
                <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              disabled={isLoading}
              data-testid="chat-input"
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              data-testid="send-button"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
