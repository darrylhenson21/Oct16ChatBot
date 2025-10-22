'use client'

import { useChat } from 'ai/react'

interface PageProps {
  params: { id: string }
  searchParams: { title?: string }
}

export default function EmbedChatPage({ params, searchParams }: PageProps) {
  const botId = params.id
  const title = searchParams.title || 'Chat'

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: `/api/bots/${botId}/chat`,
  })

  return (
    <div className="h-screen w-screen flex flex-col bg-white">
      {/* Header */}
      <div className="bg-blue-500 text-white px-4 py-3 shadow-md">
        <h1 className="font-semibold text-lg">{title}</h1>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" data-testid="embed-chat-messages">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>👋 Start a conversation...</p>
          </div>
        )}
        
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                AI
              </div>
            )}
            
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-slate-900 border border-gray-200'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            </div>

            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-semibold">
                You
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
              AI
            </div>
            <div className="bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
              <span className="text-sm text-gray-500">Typing...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="border-t p-3 bg-white">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            disabled={isLoading}
            data-testid="embed-chat-input"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            data-testid="embed-send-button"
            className="bg-blue-500 text-white px-5 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          Powered by {title}
        </p>
      </form>
    </div>
  )
}
