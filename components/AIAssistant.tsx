"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Plus, History, MoreHorizontal, Globe, ArrowUp, Clock, Paperclip } from "lucide-react"
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

export function AIAssistant({ className }: { className?: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [currentPdfFile, setCurrentPdfFile] = useState<{ id: string; name: string; previewUrl?: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [currentResponse, setCurrentResponse] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const [width, setWidth] = useState(400) // Default width
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [scrollToBottom])

  const handleSubmit = async (text: string) => {
    if (isLoading) return

    const newMessages: Message[] = []

    // If there's input, add it as a message bubble
    if (text.trim()) {
      newMessages.push({ role: "user", content: text, type: "text" })
    }

    // If there's a PDF, add it as a separate bubble with preview
    if (currentPdfFile) {
      newMessages.push({ 
        role: "user", 
        content: text.trim() ? text : "Please analyze this PDF.",
        type: "text"
      })
      newMessages.push({ 
        role: "user", 
        content: currentPdfFile.name,
        type: "file",
        fileDetails: {
          name: currentPdfFile.name,
          url: currentPdfFile.previewUrl || '',
          contentType: 'application/pdf'
        }
      })
    }

    if (newMessages.length === 0) return

    setMessages((prev) => [...prev, ...newMessages])
    setIsLoading(true)
    setCurrentResponse("")

    try {
      let fullResponse = ""
      await streamChat([...messages, ...newMessages], (chunk) => {
        fullResponse += chunk
        setCurrentResponse(fullResponse)
      }, currentPdfFile?.id)

      setMessages((prev) => [...prev, { role: "assistant", content: fullResponse }])
      setCurrentResponse("")
      // Clear PDF file after processing
      if (currentPdfFile?.previewUrl) {
        URL.revokeObjectURL(currentPdfFile.previewUrl)
      }
      setCurrentPdfFile(null)
    } catch (error) {
      console.error("Chat error:", error)
      toast({
        title: "Error",
        description: "Failed to process your request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
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
            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:bg-gray-100">
              <Plus className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:bg-gray-100">
                  <History className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs">Recent Conversations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs">
                  <Clock className="h-3 w-3 mr-2" />
                  Project Requirements Discussion
                  <DropdownMenuShortcut>2h ago</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs">
                  <Clock className="h-3 w-3 mr-2" />
                  Technical Specifications Review
                  <DropdownMenuShortcut>5h ago</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs">
                  <Clock className="h-3 w-3 mr-2" />
                  Budget Analysis
                  <DropdownMenuShortcut>1d ago</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:bg-gray-100">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-col h-[calc(100vh-112px)]">
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <p className="text-[13px] text-gray-600">
                No chat history yet. Ask a question or upload a PDF to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={index} className="flex justify-start">
                    <div className={`max-w-[80%] ${
                      message.role === "user" 
                        ? message.type === "file"
                          ? "bg-transparent" 
                          : "bg-gray-100 rounded-md px-4 py-2"
                        : "prose prose-sm max-w-none"
                    }`}>
                      {message.role === "user" ? (
                        message.type === "file" ? (
                          <PreviewAttachment
                            attachment={message.fileDetails}
                            isUploading={false}
                          />
                        ) : (
                          <div className="text-[13px] text-gray-700">{message.content}</div>
                        )
                      ) : (
                        <ReactMarkdown className="text-[13px] text-gray-700">
                          {message.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                ))}
                {currentResponse && (
                  <div className="flex justify-start">
                    <div className="prose prose-sm max-w-[80%]">
                      <ReactMarkdown className="text-[13px] text-gray-700">
                        {currentResponse}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
                {isLoading && !currentResponse && (
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
              placeholder={currentPdfFile 
                ? "Ask a question about the PDF..."
                : "Ask a question or upload a PDF..."}
              containerWidth={width}
              onSubmit={async (value, withSearch) => {
                if (isLoading) return

                // If we have a PDF loaded, always use PDF flow regardless of search toggle
                if (currentPdfFile) {
                  // Only add one message for PDF questions
                  const newMessages: Message[] = [
                    { role: "user", content: value || "Please analyze this PDF.", type: "text" },
                    { role: "user", content: currentPdfFile.name, type: "file", fileDetails: { 
                      name: currentPdfFile.name, 
                      url: currentPdfFile.previewUrl || '', 
                      contentType: 'application/pdf' 
                    }}
                  ]
                  
                  setMessages(prev => [...prev, ...newMessages])
                  setIsLoading(true)
                  setCurrentResponse("")

                  try {
                    let fullResponse = ""
                    await streamChat(
                      [...messages, ...newMessages],
                      (chunk) => {
                        fullResponse += chunk
                        setCurrentResponse(fullResponse)
                      },
                      currentPdfFile.id
                    )

                    setMessages(prev => [...prev, { role: "assistant", content: fullResponse }])
                    setCurrentResponse("")
                    // Clear PDF file after processing
                    if (currentPdfFile.previewUrl) {
                      URL.revokeObjectURL(currentPdfFile.previewUrl)
                    }
                    setCurrentPdfFile(null)
                  } catch (error) {
                    console.error("Chat error:", error)
                    toast({
                      title: "Error",
                      description: "Failed to process your request. Please try again.",
                      variant: "destructive",
                    })
                  } finally {
                    setIsLoading(false)
                  }
                  return
                }
                
                // Otherwise handle normal search/chat
                if (withSearch) {
                  setIsLoading(true)
                  setCurrentResponse("")
                  const userMessage: Message = { role: "user", content: `Search: ${value}` }
                  setMessages(prev => [...prev, userMessage])

                  try {
                    let fullResponse = ""
                    await performSearchGrounding(value, (chunk) => {
                      fullResponse += chunk
                      setCurrentResponse(fullResponse)
                    })
                    
                    const assistantMessage: Message = { 
                      role: "assistant", 
                      content: fullResponse 
                    }
                    setMessages(prev => [...prev, assistantMessage])
                    setCurrentResponse("")
                  } catch (error) {
                    console.error("Search grounding error:", error)
                    toast({
                      title: "Error",
                      description: "Failed to perform search grounding. Please try again.",
                      variant: "destructive",
                    })
                  } finally {
                    setIsLoading(false)
                  }
                } else {
                  await handleSubmit(value)
                }
              }}
              onFileSelect={async (file) => {
                if (file.type === "application/pdf") {
                  const formData = new FormData()
                  formData.append("file", file)

                  setIsLoading(true)
                  try {
                    const response = await fetch("/api/process-pdf", {
                      method: "POST",
                      body: formData,
                    })

                    if (!response.ok) throw new Error("Upload failed")

                    const { fileId, fileName } = await response.json()
                    const previewUrl = URL.createObjectURL(file)
                    setCurrentPdfFile({ id: fileId, name: fileName, previewUrl })
                  } catch (error) {
                    console.error("PDF upload error:", error)
                    toast({
                      title: "Error",
                      description: "Failed to upload the PDF. Please try again.",
                      variant: "destructive",
                    })
                  } finally {
                    setIsLoading(false)
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

