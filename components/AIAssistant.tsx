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
import { cn } from "@/lib/utils"

type ChatThread = {
  id: string
  title: string
  messages: Message[]
  currentResponse: string
  isLoading: boolean
  pdfFile: { id: string; name: string; previewUrl?: string } | null
}

interface AIAssistantProps {
  className?: string;
  onChatChange?: (chatId: string | null) => void;
}

export function AIAssistant({ className, onChatChange }: AIAssistantProps) {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [width, setWidth] = useState(400)
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const [isLoading, setIsLoading] = useState(true)

  const activeThread = activeThreadId ? threads.find(t => t.id === activeThreadId) : null

  // Load chats from database on mount
  useEffect(() => {
    const loadChats = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/chats')
        if (!response.ok) throw new Error('Failed to load chats')
        const chats = await response.json()
        
        const formattedChats: ChatThread[] = chats.map((chat: any) => ({
          id: chat.id,
          title: chat.title || 'New Chat',
          messages: chat.messages.map((msg: any) => ({
            role: msg.role,
            content: msg.content,
            type: msg.type || 'text',
            fileDetails: msg.fileDetails ? JSON.parse(msg.fileDetails) : null
          })),
          currentResponse: '',
          isLoading: false,
          pdfFile: null
        }))
        
        setThreads(formattedChats)
        
        // If we have chats, set the first one as active
        if (formattedChats.length > 0) {
          setActiveThreadId(formattedChats[0].id)
          if (onChatChange) {
            onChatChange(formattedChats[0].id)
          }
        }
      } catch (error) {
        console.error('Error loading chats:', error)
        toast({
          title: "Error",
          description: "Failed to load chat history.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }
    loadChats()
  }, [])

  const createNewThread = async () => {
    if (isLoading) return; // Prevent multiple simultaneous creations
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create chat');
      }
      
      const savedChat = await response.json();
      
      // Only create the thread in state after successful API call
      const newThread: ChatThread = {
        id: savedChat.id,
        title: 'New Chat',
        messages: [],
        currentResponse: '',
        isLoading: false,
        pdfFile: null
      };
      
      setThreads(prev => [...prev, newThread]);
      setActiveThreadId(newThread.id);
      
      // Notify parent component if callback exists
      if (onChatChange) {
        onChatChange(newThread.id);
      }

      return newThread.id;
    } catch (error) {
      console.error('Error creating chat:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create new chat. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // New function to handle sending messages with a check for temporary chat thread
  const sendMessage = async (content: string) => {
    if (activeThread && activeThread.id.startsWith("temp-")) {
      toast({
        title: "Please wait",
        description: "Chat is still being created. Please wait before sending messages.",
        variant: "destructive"
      });
      return;
    }
    try {
      const response = await fetch('/api/messages', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           content,
           role: "user",
           chatId: activeThread.id
        })
      });
      if (!response.ok) throw new Error("Failed to send message");
      const message = await response.json();
      // Update the active thread's messages
      updateThread(activeThread.id, { messages: [...activeThread.messages, message] });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to process message. Try again.",
        variant: "destructive"
      });
    }
  };

  // New function to handle deleting a chat thread
  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete chat");
      setThreads(prev => prev.filter(thread => thread.id !== chatId));
      if (activeThread?.id === chatId) {
        const remaining = threads.filter(thread => thread.id !== chatId);
        if (remaining.length > 0) {
          setActiveThreadId(remaining[0].id);
        } else {
          await createNewThread();
        }
      }
      toast({
        title: "Chat deleted",
        description: "Chat thread has been deleted successfully."
      });
    } catch (error) {
      console.error("Error deleting chat:", error);
      toast({
        title: "Error",
        description: "Failed to delete chat.",
        variant: "destructive"
      });
    }
  };

  const deleteAllChats = async () => {
    if (!threads.length) return;
    
    try {
      const response = await fetch('/api/chats/delete-all', { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete all chats');
      
      setThreads([]);
      await createNewThread();
      
      toast({
        title: "All chats deleted",
        description: "All chat threads have been deleted successfully."
      });
    } catch (error) {
      console.error('Error deleting all chats:', error);
      toast({
        title: "Error",
        description: "Failed to delete all chats.",
        variant: "destructive"
      });
    }
  };

  const updateThread = (threadId: string, updates: Partial<ChatThread>) => {
    setThreads(prev => prev.map(thread => 
      thread.id === threadId 
        ? { ...thread, ...updates }
        : thread
    ))
  }

  const deleteThread = async (threadId: string) => {
    try {
      const response = await fetch(`/api/chats/${threadId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete chat');

      setThreads(prev => {
        const newThreads = prev.filter(thread => thread.id !== threadId);
        // If we're deleting the active thread, switch to another one
        if (activeThreadId === threadId && newThreads.length > 0) {
          setActiveThreadId(newThreads[0].id);
        } else if (newThreads.length === 0) {
          // If no threads left, create a new one
          createNewThread();
        }
        return newThreads;
      });
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: "Error",
        description: "Failed to delete chat.",
        variant: "destructive",
      });
    }
  }

  // Update thread title based on first message
  useEffect(() => {
    if (activeThread?.messages.length === 1 && activeThread.messages[0].role === 'user') {
      const title = activeThread.messages[0].content.slice(0, 30) + (activeThread.messages[0].content.length > 30 ? '...' : '')
      updateThread(activeThread.id, { title })
    }
  }, [activeThread?.messages])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  // Add auto-scroll effect for streaming
  useEffect(() => {
    if (activeThread?.currentResponse) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [activeThread?.currentResponse])

  // Keep existing scroll effect for new messages
  useEffect(() => {
    scrollToBottom()
  }, [scrollToBottom, activeThread?.messages])

  const handleSubmit = async (text: string) => {
    if (!activeThread || activeThread.isLoading) return

    const thread = activeThread; // Create a stable reference that TypeScript can track

    // Ensure chat exists before proceeding
    try {
      const chatResponse = await fetch(`/api/chats/${thread.id}`, {
        method: 'GET'
      });
      
      if (!chatResponse.ok) {
        // If chat doesn't exist, create it first
        const createResponse = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Chat' })
        });
        
        if (!createResponse.ok) {
          throw new Error('Failed to create chat');
        }
        
        const savedChat = await createResponse.json();
        thread.id = savedChat.id;
      }
    } catch (error) {
      console.error('Error verifying chat:', error);
      toast({
        title: "Error",
        description: "Failed to verify chat exists. Please try again.",
        variant: "destructive",
      });
      return;
    }

    const newMessages: Message[] = []

    // If there's input, add it as a message bubble
    if (text.trim()) {
      newMessages.push({ role: "user", content: text, type: "text" })
    }

    // If there's a PDF, add it as a separate bubble with preview
    if (thread.pdfFile) {
      if (!text.trim()) {
        newMessages.push({ 
          role: "user", 
          content: "Please analyze this PDF.",
          type: "text"
        })
      }
      newMessages.push({ 
        role: "user", 
        content: thread.pdfFile.name,
        type: "file",
        fileDetails: {
          name: thread.pdfFile.name,
          url: thread.pdfFile.previewUrl || '',
          contentType: 'application/pdf'
        }
      })
    }

    if (newMessages.length === 0) return

    // Update UI optimistically
    const updatedMessages = [...thread.messages, ...newMessages]
    updateThread(thread.id, { 
      messages: updatedMessages,
      isLoading: true,
      currentResponse: "" 
    })

    try {
      // First, save the user messages
      const userResponse = await fetch(`/api/chats/${thread.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });

      if (!userResponse.ok) {
        throw new Error('Failed to save user messages');
      }

      // Then start streaming and wait for completion
      let fullResponse = ""
      await streamChat(updatedMessages, (chunk) => {
        fullResponse += chunk
        updateThread(thread.id, { currentResponse: fullResponse })
      }, thread.pdfFile?.id);

      // After streaming is complete, save the assistant's message
      const assistantMessage: Message = { 
        role: "assistant", 
        content: fullResponse,
        type: "text"
      }
      
      const assistantResponse = await fetch(`/api/chats/${thread.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [assistantMessage] })
      })

      if (!assistantResponse.ok) {
        throw new Error('Failed to save assistant message');
      }

      // Update UI with the final state
      updateThread(thread.id, { 
        messages: [...updatedMessages, assistantMessage],
        currentResponse: "",
        isLoading: false,
        pdfFile: null // Clear the PDF after processing
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process your message. Please try again.",
        variant: "destructive",
      })
      // Revert the thread state on error
      updateThread(thread.id, { 
        messages: thread.messages,
        currentResponse: "",
        isLoading: false
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

  // Update the parent component when active thread changes
  useEffect(() => {
    onChatChange?.(activeThreadId)
  }, [activeThreadId, onChatChange])

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
            {threads.length > 0 && (
              <Button
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={deleteAllChats}
              >
                Delete All
              </Button>
            )}
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
                          handleDeleteChat(thread.id)
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
            {isLoading ? (
              <div className="flex items-center gap-2 text-[13px] text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Loading chats...</span>
              </div>
            ) : !activeThread ? (
              <p className="text-[13px] text-gray-600">
                No chat selected
              </p>
            ) : activeThread.messages.length === 0 ? (
              <p className="text-[13px] text-gray-600">
                Ask a question or upload a PDF to get started.
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
              placeholder={activeThread?.pdfFile 
                ? "Ask a question about the PDF..."
                : "Ask a question or upload a PDF..."}
              containerWidth={width}
              onSubmit={async (value, withSearch) => {
                if (!activeThread) {
                  toast({
                    title: "Error",
                    description: "No active chat selected. Please try again.",
                    variant: "destructive",
                  })
                  return
                }

                if (activeThread.isLoading) return

                // If we have a PDF loaded, always use PDF flow regardless of search toggle
                if (activeThread.pdfFile) {
                  await handleSubmit(value)
                  return
                }
                
                // Otherwise handle normal search/chat
                if (withSearch) {
                  const userMessage: Message = { role: "user", content: `Search: ${value}`, type: "text" }
                  
                  // Update UI optimistically
                  const updatedMessages = [...activeThread.messages, userMessage]
                  updateThread(activeThread.id, { 
                    messages: updatedMessages,
                    isLoading: true,
                    currentResponse: "" 
                  })

                  try {
                    // First save the user message
                    const userResponse = await fetch(`/api/chats/${activeThread.id}/messages`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ messages: [userMessage] })
                    });

                    if (!userResponse.ok) {
                      throw new Error('Failed to save user message');
                    }

                    // Then perform the search
                    let fullResponse = ""
                    await performSearchGrounding(value, (chunk) => {
                      fullResponse += chunk
                      updateThread(activeThread.id, { currentResponse: fullResponse })
                    })
                    
                    // After search is complete, save the assistant's message
                    const assistantMessage: Message = { 
                      role: "assistant", 
                      content: fullResponse,
                      type: "text"
                    }

                    const assistantResponse = await fetch(`/api/chats/${activeThread.id}/messages`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ messages: [assistantMessage] })
                    })

                    if (!assistantResponse.ok) {
                      throw new Error('Failed to save assistant message');
                    }

                    // Update UI with final state
                    updateThread(activeThread.id, { 
                      messages: [...updatedMessages, assistantMessage],
                      isLoading: false,
                      currentResponse: ""
                    })
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to perform search. Please try again.",
                      variant: "destructive",
                    })
                    // Revert thread state on error
                    updateThread(activeThread.id, { 
                      messages: activeThread.messages,
                      isLoading: false,
                      currentResponse: ""
                    })
                  }
                } else {
                  await handleSubmit(value)
                }
              }}
              onFileSelect={async (file) => {
                if (!activeThread) {
                  toast({
                    title: "Error",
                    description: "No active chat selected. Please try again.",
                    variant: "destructive",
                  })
                  return
                }

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
