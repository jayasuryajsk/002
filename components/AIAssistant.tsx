"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Plus, History, MoreHorizontal, Globe, ArrowUp, Clock, Paperclip, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type Message, streamChat, uploadAndProcessPDF, performSearchGrounding } from "@/lib/chat"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/use-toast"
import ReactMarkdown from "react-markdown"
import { Loader2 } from "lucide-react"
import type React from "react"
import { AIInputWithSearch } from "@/components/ui/ai-input-with-search"
import { PreviewAttachment } from "@/components/ui/PreviewAttachment"
import { v4 as uuidv4 } from 'uuid'

type ChatThread = {
  id: string
  title: string
  messages: Message[]
  currentResponse: string
  isLoading: boolean
  pdfFile: { id: string; name: string; previewUrl?: string } | null
}

export function AIAssistant({ className }: { className?: string }) {
  const [threads, setThreads] = useState<ChatThread[]>([{
    id: uuidv4(),
    title: 'New Chat',
    messages: [],
    currentResponse: '',
    isLoading: false,
    pdfFile: null
  }])
  const [activeThreadId, setActiveThreadId] = useState<string>(threads[0].id)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [width, setWidth] = useState(400)
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const activeThread = threads.find(t => t.id === activeThreadId)!

  const createNewThread = () => {
    const newThread: ChatThread = {
      id: uuidv4(),
      title: 'New Chat',
      messages: [],
      currentResponse: '',
      isLoading: false,
      pdfFile: null
    }
    setThreads(prev => [...prev, newThread])
    setActiveThreadId(newThread.id)
  }

  const updateThread = (threadId: string, updates: Partial<ChatThread>) => {
    setThreads(prev => prev.map(thread => 
      thread.id === threadId 
        ? { ...thread, ...updates }
        : thread
    ))
  }

  const deleteThread = (threadId: string) => {
    setThreads(prev => prev.filter(thread => thread.id !== threadId))
    if (activeThreadId === threadId) {
      setActiveThreadId(threads[0].id)
    }
  }

  // Update thread title based on first message
  useEffect(() => {
    if (activeThread.messages.length === 1 && activeThread.messages[0].role === 'user') {
      const title = activeThread.messages[0].content.slice(0, 30) + (activeThread.messages[0].content.length > 30 ? '...' : '')
      updateThread(activeThread.id, { title })
    }
  }, [activeThread.messages])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  // Add auto-scroll effect for streaming
  useEffect(() => {
    if (activeThread.currentResponse) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [activeThread.currentResponse])

  // Keep existing scroll effect for new messages
  useEffect(() => {
    scrollToBottom()
  }, [scrollToBottom, activeThread.messages])

  const handleSubmit = async (text: string) => {
    if (activeThread.isLoading) return

    const newMessages: Message[] = []

    // If there's input, add it as a message bubble
    if (text.trim()) {
      newMessages.push({ role: "user", content: text, type: "text" })
    }

    // If there's a PDF, add it as a separate bubble with preview
    if (activeThread.pdfFile) {
      newMessages.push({ 
        role: "user", 
        content: text.trim() ? text : "Please analyze this PDF.",
        type: "text"
      })
      newMessages.push({ 
        role: "user", 
        content: activeThread.pdfFile.name,
        type: "file",
        fileDetails: {
          name: activeThread.pdfFile.name,
          url: activeThread.pdfFile.previewUrl || '',
          contentType: 'application/pdf'
        }
      })
    }

    if (newMessages.length === 0) return

    updateThread(activeThread.id, { messages: [...activeThread.messages, ...newMessages] })
    updateThread(activeThread.id, { isLoading: true })
    updateThread(activeThread.id, { currentResponse: "" })

    try {
      let fullResponse = ""
      await streamChat([...activeThread.messages, ...newMessages], (chunk) => {
        fullResponse += chunk
        updateThread(activeThread.id, { currentResponse: fullResponse })
      }, activeThread.pdfFile?.id)

      updateThread(activeThread.id, { 
        messages: [...activeThread.messages, ...newMessages, { role: "assistant", content: fullResponse }],
        isLoading: false,
        currentResponse: ""
      })
      // Clear PDF file after processing
      if (activeThread.pdfFile?.previewUrl) {
        URL.revokeObjectURL(activeThread.pdfFile.previewUrl)
      }
      updateThread(activeThread.id, { pdfFile: null })
    } catch (error) {
      console.error("Chat error:", error)
      toast({
        title: "Error",
        description: "Failed to process your request. Please try again.",
        variant: "destructive",
      })
    }
  }

  const startResizing = useCallback((e: React.MouseEvent) => {
    isResizing.current = true
    startX.current = e.pageX
    startWidth.current = width
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  const stopResizing = useCallback(() => {
    isResizing.current = false
    document.body.style.cursor = 'default'
    document.body.style.userSelect = 'auto'
  }, [])

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return

    const newWidth = startWidth.current - (e.pageX - startX.current)
    // Set min and max width limits
    if (newWidth > 300 && newWidth < 800) {
      setWidth(newWidth)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', resize)
    document.addEventListener('mouseup', stopResizing)
    return () => {
      document.removeEventListener('mousemove', resize)
      document.removeEventListener('mouseup', stopResizing)
    }
  }, [resize, stopResizing])

  return (
    <div 
      className={`bg-white flex ${className}`} 
      style={{ width: `${width}px` }}
    >
      <div
        className="w-1 cursor-ew-resize hover:bg-gray-200 transition-colors"
        onMouseDown={startResizing}
      />
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between h-12 px-4 border-b border-gray-200">
          <span className="text-[13px] text-gray-700 font-medium">AI Assistant (Gemini 2.0 Flash)</span>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-gray-500 hover:bg-gray-100"
              onClick={createNewThread}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:bg-gray-100">
                  <History className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs">Chat Threads</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {threads.map((thread) => (
                  <DropdownMenuItem 
                    key={thread.id} 
                    className="text-xs flex items-center justify-between group"
                    onClick={() => setActiveThreadId(thread.id)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{thread.title}</span>
                    </div>
                    {threads.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteThread(thread.id)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:bg-gray-100">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-col h-[calc(100vh-112px)]">
          <ScrollArea className="flex-1 p-4">
            {activeThread.messages.length === 0 ? (
              <p className="text-[13px] text-gray-600">
                No chat history yet. Ask a question or upload a PDF to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {activeThread.messages.map((message, index) => (
                  <div key={index} className="flex justify-start w-full">
                    <div className={`w-full ${
                      message.role === "user" 
                        ? message.type === "file"
                          ? "bg-transparent" 
                          : "bg-gray-100 rounded-md px-4 py-2"
                        : "prose prose-sm max-w-none w-full"
                    }`}>
                      {message.role === "user" ? (
                        message.type === "file" ? (
                          <PreviewAttachment
                            attachment={{
                              name: message.fileDetails?.name || '',
                              url: message.fileDetails?.url || '',
                              contentType: message.fileDetails?.contentType
                            }}
                            isUploading={false}
                          />
                        ) : (
                          <div className="text-[13px] text-gray-700">{message.content}</div>
                        )
                      ) : (
                        <ReactMarkdown className="text-[13px] text-gray-700 [&>*]:mb-4 [&>*:last-child]:mb-0 [&>p]:leading-relaxed [&>ul]:space-y-2 [&>ol]:space-y-2 [&>h1]:text-xl [&>h2]:text-lg [&>h2]:mt-6 [&>h3]:text-base [&>h3]:mt-4 [&>blockquote]:pl-4 [&>blockquote]:border-l-2 [&>blockquote]:border-gray-300 [&>blockquote]:italic [&>pre]:bg-gray-100 [&>pre]:p-4 [&>pre]:rounded-md [&>pre]:overflow-auto [&>code]:bg-gray-100 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded">
                          {message.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                ))}
                {activeThread.currentResponse && (
                  <div className="flex justify-start w-full">
                    <div className="prose prose-sm w-full">
                      <ReactMarkdown className="text-[13px] text-gray-700 [&>*]:mb-4 [&>*:last-child]:mb-0 [&>p]:leading-relaxed [&>ul]:space-y-2 [&>ol]:space-y-2 [&>h1]:text-xl [&>h2]:text-lg [&>h2]:mt-6 [&>h3]:text-base [&>h3]:mt-4 [&>blockquote]:pl-4 [&>blockquote]:border-l-2 [&>blockquote]:border-gray-300 [&>blockquote]:italic [&>pre]:bg-gray-100 [&>pre]:p-4 [&>pre]:rounded-md [&>pre]:overflow-auto [&>code]:bg-gray-100 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded">
                        {activeThread.currentResponse}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
                {activeThread.isLoading && !activeThread.currentResponse && (
                  <div className="flex items-center gap-2 text-[13px] text-gray-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
          <div className="border-gray-200">
            <AIInputWithSearch
              placeholder={activeThread.pdfFile 
                ? "Ask a question about the PDF..."
                : "Ask a question or upload a PDF..."}
              containerWidth={width}
              onSubmit={async (value, withSearch) => {
                if (activeThread.isLoading) return

                // If we have a PDF loaded, always use PDF flow regardless of search toggle
                if (activeThread.pdfFile) {
                  // Only add one message for PDF questions
                  const newMessages: Message[] = [
                    { role: "user", content: value || "Please analyze this PDF.", type: "text" },
                    { role: "user", content: activeThread.pdfFile.name, type: "file", fileDetails: { 
                      name: activeThread.pdfFile.name, 
                      url: activeThread.pdfFile.previewUrl || '', 
                      contentType: 'application/pdf' 
                    }}
                  ]
                  
                  updateThread(activeThread.id, { messages: [...activeThread.messages, ...newMessages] })
                  updateThread(activeThread.id, { isLoading: true })
                  updateThread(activeThread.id, { currentResponse: "" })

                  try {
                    let fullResponse = ""
                    await streamChat(
                      [...activeThread.messages, ...newMessages],
                      (chunk) => {
                        fullResponse += chunk
                        updateThread(activeThread.id, { currentResponse: fullResponse })
                      },
                      activeThread.pdfFile.id
                    )

                    updateThread(activeThread.id, { 
                      messages: [...activeThread.messages, ...newMessages, { role: "assistant", content: fullResponse }],
                      isLoading: false,
                      currentResponse: ""
                    })
                    // Clear PDF file after processing
                    if (activeThread.pdfFile.previewUrl) {
                      URL.revokeObjectURL(activeThread.pdfFile.previewUrl)
                    }
                    updateThread(activeThread.id, { pdfFile: null })
                  } catch (error) {
                    console.error("Chat error:", error)
                    toast({
                      title: "Error",
                      description: "Failed to process your request. Please try again.",
                      variant: "destructive",
                    })
                  }
                  return
                }
                
                // Otherwise handle normal search/chat
                if (withSearch) {
                  updateThread(activeThread.id, { isLoading: true })
                  updateThread(activeThread.id, { currentResponse: "" })
                  const userMessage: Message = { role: "user", content: `Search: ${value}` }
                  updateThread(activeThread.id, { messages: [...activeThread.messages, userMessage] })

                  try {
                    let fullResponse = ""
                    await performSearchGrounding(value, (chunk) => {
                      fullResponse += chunk
                      updateThread(activeThread.id, { currentResponse: fullResponse })
                    })
                    
                    const assistantMessage: Message = { 
                      role: "assistant", 
                      content: fullResponse 
                    }
                    updateThread(activeThread.id, { 
                      messages: [...activeThread.messages, userMessage, assistantMessage],
                      isLoading: false,
                      currentResponse: ""
                    })
                  } catch (error) {
                    console.error("Search grounding error:", error)
                    toast({
                      title: "Error",
                      description: "Failed to perform search grounding. Please try again.",
                      variant: "destructive",
                    })
                  }
                } else {
                  await handleSubmit(value)
                }
              }}
              onFileSelect={async (file) => {
                if (file.type === "application/pdf") {
                  const formData = new FormData()
                  formData.append("file", file)

                  updateThread(activeThread.id, { isLoading: true })
                  try {
                    const response = await fetch("/api/process-pdf", {
                      method: "POST",
                      body: formData,
                    })

                    if (!response.ok) throw new Error("Upload failed")

                    const { fileId, fileName } = await response.json()
                    const previewUrl = URL.createObjectURL(file)
                    updateThread(activeThread.id, { pdfFile: { id: fileId, name: fileName, previewUrl } })
                  } catch (error) {
                    console.error("PDF upload error:", error)
                    toast({
                      title: "Error",
                      description: "Failed to upload the PDF. Please try again.",
                      variant: "destructive",
                    })
                  } finally {
                    updateThread(activeThread.id, { isLoading: false })
                  }
                } else {
                  toast({
                    title: "Error",
                    description: "Only PDF files are supported.",
                    variant: "destructive",
                  })
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

