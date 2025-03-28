"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Plus, History, MoreHorizontal, Globe, ArrowUp, Clock, Paperclip, X, ChevronDown, Trash2 } from "lucide-react"
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
import { motion, AnimatePresence } from "framer-motion"

// Add interface for extended Message type at the top of the file
interface ExtendedMessage extends Message {
  id?: string;
  type?: "text" | "file" | "selected-text" | string;
  selectedText?: string;
  selectionInfo?: any;
  fileDetails?: any;
}

type ChatThread = {
  id: string
  title: string
  messages: ExtendedMessage[]
  currentResponse: string
  isLoading: boolean
  pdfFile: { id: string; name: string; previewUrl?: string } | null
}

interface AIAssistantProps {
  className?: string;
  onChatChange?: (chatId: string | null) => void;
  onAddToChat?: (selectedText: string) => void;
  selectedText?: string;
  onApplyEdit?: (text: string, selectionInfo: any) => void;
}

// Custom hook for resizable panel
const useResizablePanel = (initialWidth = 400) => {
  const [width, setWidth] = useState(initialWidth)
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

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

  return { width, startResizing }
}

// Custom hook for chat thread management
const useChatThreads = (onChatChange?: (chatId: string | null) => void) => {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const activeThread = useMemo(() => 
    activeThreadId ? threads.find(t => t.id === activeThreadId) : null
  , [activeThreadId, threads])

  useEffect(() => {
    onChatChange?.(activeThreadId)
  }, [activeThreadId, onChatChange])

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
            id: msg.id || Math.random().toString(36).substring(2, 9),
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
        } else {
          // If no chats exist, create a new one automatically
          createNewChatThread();
        }
      } catch (error) {
        console.error('Error loading chats:', error)
        toast({
          title: "Error",
          description: "Failed to load chat history.",
          variant: "destructive",
        })
        // Even on error, try to create a new chat so the user isn't stuck
        createNewChatThread();
      } finally {
        setIsLoading(false)
      }
    }
    loadChats()
  }, [onChatChange])

  // Helper function to create a new chat thread
  const createNewChatThread = useCallback(async () => {
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
    } catch (error) {
      console.error('Error creating initial chat:', error);
      // Create a fallback local-only chat as a last resort
      const fallbackId = Math.random().toString(36).substring(2, 15);
      const fallbackThread: ChatThread = {
        id: fallbackId,
        title: 'New Chat',
        messages: [],
        currentResponse: '',
        isLoading: false,
        pdfFile: null
      };
      setThreads([fallbackThread]);
      setActiveThreadId(fallbackId);
      if (onChatChange) {
        onChatChange(fallbackId);
      }
    }
  }, [onChatChange]);

  const updateThread = useCallback((threadId: string, updates: Partial<ChatThread>) => {
    setThreads(prev => prev.map(thread => 
      thread.id === threadId 
        ? { ...thread, ...updates }
        : thread
    ))
  }, []);

  const deleteThread = useCallback(async (threadId: string) => {
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
          createNewChatThread();
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
  }, [activeThreadId, createNewChatThread, toast]);

  const deleteAllChats = useCallback(async () => {
    if (!threads.length) return;
    
    try {
      const response = await fetch('/api/chats/delete-all', { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete all chats');
      
      setThreads([]);
      createNewChatThread();
      
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
  }, [threads.length, createNewChatThread, toast]);

  // Create a new chat if none exists after initial load
  useEffect(() => {
    if (!isLoading && threads.length === 0) {
      createNewChatThread();
    }
  }, [isLoading, threads.length, createNewChatThread]);

  return {
    threads,
    activeThread,
    activeThreadId,
    isLoading,
    setActiveThreadId,
    createNewChatThread,
    updateThread,
    deleteThread,
    deleteAllChats
  }
}

// No need to detect direct replacement anymore, we always apply edits for responses to selected text

// Component for rendering a single message
const MessageItem = ({ 
  message, 
  onApplyEdit,
  messageIndex,
  messages
}: { 
  message: ExtendedMessage, 
  onApplyEdit?: (text: string) => void,
  messageIndex: number,
  messages: ExtendedMessage[]
}) => {
  if (message.role === "user") {
    if (message.type === "file") {
      return (
        <PreviewAttachment
          attachment={{
            name: message.fileDetails?.name || '',
            url: message.fileDetails?.url || '',
            contentType: message.fileDetails?.contentType
          }}
          isUploading={false}
        />
      );
    }
    
    // If this is a selected text message, show a special UI
    if (message.type === "selected-text" && message.selectedText) {
      return (
        <div className="text-[13px] text-gray-700">
          <div className="bg-blue-50 p-2 rounded-md mb-2 text-blue-700 text-xs">
            <span className="font-medium">
              {message.selectionInfo?.lines || "Selected text"}:
            </span>
            <div className="mt-1 p-2 bg-white rounded border border-blue-100 whitespace-pre-wrap text-gray-700 font-mono text-xs max-h-20 overflow-y-auto">
              {message.selectedText}
            </div>
          </div>
          {message.content}
        </div>
      );
    }
    
    return <div className="text-[13px] text-gray-700">{message.content}</div>;
  }
  
  // For assistant messages, check if this is likely a response to selected text
  const prevMessage = messageIndex > 0 ? messages[messageIndex - 1] : undefined;
  const isEditSuggestion = message.role === "assistant" && prevMessage?.type === "selected-text";

  // State to track pending edits that need approval
  const [pendingEdit, setPendingEdit] = useState<string | null>(null);

  // Find possible original text from previous message
  const originalText = useMemo(() => {
    return prevMessage?.selectedText || "";
  }, [prevMessage]);

  // Create edit suggestion for user approval - only run once when message is received
  useEffect(() => {
    // Create a flag to prevent multiple processing
    // @ts-ignore
    if (isEditSuggestion && onApplyEdit && !message._processed) {
      // Mark as processed to prevent infinite loop
      // @ts-ignore
      message._processed = true;
      
      let textToApply = message.content;
            
      // Remove wrapping quotes if present
      if ((textToApply.startsWith('"') && textToApply.endsWith('"')) ||
          (textToApply.startsWith("'") && textToApply.endsWith("'"))) {
        textToApply = textToApply.substring(1, textToApply.length - 1);
      }
      
      // Store the edit suggestion for approval
      console.log("Storing edit for approval", textToApply);
      setPendingEdit(textToApply);
    }
  }, [isEditSuggestion, message.id]); // Only depend on message.id to prevent infinite loops
  
  // Function to apply the pending edit
  const applyPendingEdit = useCallback(() => {
    if (pendingEdit && onApplyEdit) {
      onApplyEdit(pendingEdit);
      setPendingEdit(null); // Clear pending edit after application
    }
  }, [pendingEdit, onApplyEdit]);

  return (
    <div className="w-full">
      {pendingEdit ? (
        <div className="w-full">
          <div className="mb-3">
            <ReactMarkdown className="text-[13px] text-gray-700">
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Diff Preview */}
          <div className="border rounded-md overflow-hidden mb-3 text-[13px]">
            <div className="bg-gray-100 px-3 py-1 text-xs text-gray-600 font-medium border-b">
              Changes Preview:
            </div>
            <div className="p-3 space-y-2">
              <div className="bg-red-50 p-2 rounded-md border border-red-100">
                <div className="font-mono text-red-700 text-xs line-through">{originalText}</div>
              </div>
              <div className="flex items-center justify-center">
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
              <div className="bg-green-50 p-2 rounded-md border border-green-100">
                <div className="font-mono text-green-700 text-xs">{pendingEdit}</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <Button 
              size="sm" 
              variant="default" 
              className="text-xs bg-green-500 hover:bg-green-600" 
              onClick={applyPendingEdit}
            >
              Apply Changes
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs" 
              onClick={() => setPendingEdit(null)}
            >
              Discard
            </Button>
          </div>
        </div>
      ) : (
        <ReactMarkdown className="text-[13px] text-gray-700 [&>*]:mb-4 [&>*:last-child]:mb-0 [&>p]:leading-relaxed [&>ul]:space-y-2 [&>ol]:space-y-2 [&>h1]:text-xl [&>h2]:text-lg [&>h2]:mt-6 [&>h3]:text-base [&>h3]:mt-4 [&>blockquote]:pl-4 [&>blockquote]:border-l-2 [&>blockquote]:border-gray-300 [&>blockquote]:italic [&>pre]:bg-gray-100 [&>pre]:p-4 [&>pre]:rounded-md [&>pre]:overflow-auto [&>pre]:max-w-full [&>pre]:whitespace-pre-wrap [&>code]:bg-gray-100 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:break-words">
          {message.content}
        </ReactMarkdown>
      )}
    </div>
  );
};

// Component for the chat messages display
const ChatMessages = ({ 
  activeThread,
  isLoading,
  messagesEndRef,
  onApplyEdit
}: { 
  activeThread: ChatThread | null,
  isLoading: boolean,
  messagesEndRef: React.RefObject<HTMLDivElement>,
  onApplyEdit?: (text: string, selectionInfo?: any) => void
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-gray-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Loading chats...</span>
      </div>
    );
  }
  
  if (!activeThread) {
    return (
      <p className="text-[13px] text-gray-600">
        No chat selected
      </p>
    );
  }
  
  if (activeThread.messages.length === 0) {
    return (
      <p className="text-[13px] text-gray-600">
        Ask a question or upload a PDF to get started.
      </p>
    );
  }
  
  return (
    <div className="space-y-4">
      {activeThread.messages.map((message, index) => (
        <motion.div 
          key={index} 
          className="flex justify-start w-full"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className={`w-full ${
            message.role === "user" 
              ? message.type === "file"
                ? "bg-transparent" 
                : message.type === "selected-text"
                  ? "bg-transparent"
                  : "bg-gray-100 rounded-md px-4 py-2"
              : "prose prose-sm max-w-none w-full"
          }`}>
            <MessageItem 
              message={message}
              messageIndex={index}
              messages={activeThread.messages}
              onApplyEdit={(text) => {
                // Get selection info from the previous message if it exists
                const prevMessage = index > 0 ? activeThread.messages[index-1] : undefined;
                if (prevMessage?.type === "selected-text" && prevMessage.selectionInfo) {
                  // Directly apply edit to the editor
                  onApplyEdit?.(text, prevMessage.selectionInfo);
                }
              }}
            />
          </div>
        </motion.div>
      ))}
      
      {activeThread.currentResponse && (
        <motion.div 
          className="flex justify-start w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="prose prose-sm w-full">
            <ReactMarkdown className="text-[13px] text-gray-700 [&>*]:mb-4 [&>*:last-child]:mb-0 [&>p]:leading-relaxed [&>ul]:space-y-2 [&>ol]:space-y-2 [&>h1]:text-xl [&>h2]:text-lg [&>h2]:mt-6 [&>h3]:text-base [&>h3]:mt-4 [&>blockquote]:pl-4 [&>blockquote]:border-l-2 [&>blockquote]:border-gray-300 [&>blockquote]:italic [&>pre]:bg-gray-100 [&>pre]:p-4 [&>pre]:rounded-md [&>pre]:overflow-auto [&>pre]:max-w-full [&>pre]:whitespace-pre-wrap [&>code]:bg-gray-100 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:break-words">
              {activeThread.currentResponse}
            </ReactMarkdown>
          </div>
        </motion.div>
      )}
      
      {activeThread.isLoading && !activeThread.currentResponse && (
        <div className="flex items-center gap-2 text-[13px] text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Thinking...</span>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
};

// Component for chat thread list dropdown
const ChatThreadList = ({ 
  threads, 
  setActiveThreadId, 
  handleDeleteChat 
}: { 
  threads: ChatThread[], 
  setActiveThreadId: (id: string) => void, 
  handleDeleteChat: (id: string) => void 
}) => {
  return (
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
  );
};

// Custom hook for chat operations
const useChatOperations = (
  activeThread: ChatThread | null,
  updateThread: (threadId: string, updates: Partial<ChatThread>) => void
) => {
  const { toast } = useToast();
  
  const handleSubmit = useCallback(async (text: string) => {
    if (!activeThread || activeThread.isLoading) return;

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

    const newMessages: ExtendedMessage[] = [];

    // If there's input, add it as a message bubble
    if (text.trim()) {
      newMessages.push({ role: "user", content: text, type: "text" });
    }

    // If there's a PDF, add it as a separate bubble with preview
    if (thread.pdfFile) {
      if (!text.trim()) {
        newMessages.push({ 
          role: "user", 
          content: "Please analyze this PDF.",
          type: "text"
        });
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
      });
    }

    if (newMessages.length === 0) return;

    // Update UI optimistically
    const updatedMessages = [...thread.messages, ...newMessages];
    updateThread(thread.id, { 
      messages: updatedMessages,
      isLoading: true,
      currentResponse: "" 
    });

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
      let fullResponse = "";
      await streamChat(updatedMessages, (chunk) => {
        fullResponse += chunk;
        updateThread(thread.id, { currentResponse: fullResponse });
      }, thread.pdfFile?.id);

      // After streaming is complete, save the assistant's message
      const assistantMessage: ExtendedMessage = { 
        role: "assistant", 
        content: fullResponse,
        type: "text"
      };
      
      const assistantResponse = await fetch(`/api/chats/${thread.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [assistantMessage] })
      });

      if (!assistantResponse.ok) {
        throw new Error('Failed to save assistant message');
      }

      // Update UI with the final state
      updateThread(thread.id, { 
        messages: [...updatedMessages, assistantMessage],
        currentResponse: "",
        isLoading: false,
        pdfFile: null // Clear the PDF after processing
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process your message. Please try again.",
        variant: "destructive",
      });
      // Revert the thread state on error
      updateThread(thread.id, { 
        messages: thread.messages,
        currentResponse: "",
        isLoading: false
      });
    }
  }, [activeThread, updateThread, toast]);

  const handleSearch = useCallback(async (value: string) => {
    if (!activeThread || activeThread.isLoading) return;
    
    const userMessage: ExtendedMessage = { role: "user", content: `Search: ${value}`, type: "text" };
    
    // Update UI optimistically
    const updatedMessages = [...activeThread.messages, userMessage];
    updateThread(activeThread.id, { 
      messages: updatedMessages,
      isLoading: true,
      currentResponse: "" 
    });

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
      let fullResponse = "";
      await performSearchGrounding(value, (chunk) => {
        fullResponse += chunk;
        updateThread(activeThread.id, { currentResponse: fullResponse });
      });
      
      // After search is complete, save the assistant's message
      const assistantMessage: ExtendedMessage = { 
        role: "assistant", 
        content: fullResponse,
        type: "text"
      };

      const assistantResponse = await fetch(`/api/chats/${activeThread.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [assistantMessage] })
      });

      if (!assistantResponse.ok) {
        throw new Error('Failed to save assistant message');
      }

      // Update UI with final state
      updateThread(activeThread.id, { 
        messages: [...updatedMessages, assistantMessage],
        isLoading: false,
        currentResponse: ""
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to perform search. Please try again.",
        variant: "destructive",
      });
      // Revert thread state on error
      updateThread(activeThread.id, { 
        messages: activeThread.messages,
        isLoading: false,
        currentResponse: ""
      });
    }
  }, [activeThread, updateThread, toast]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!activeThread) {
      toast({
        title: "Error",
        description: "No active chat selected. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (file.type === "application/pdf") {
      const formData = new FormData();
      formData.append("file", file);

      updateThread(activeThread.id, { isLoading: true });
      try {
        const response = await fetch("/api/process-pdf", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("Upload failed");

        const { fileId, fileName } = await response.json();
        const previewUrl = URL.createObjectURL(file);
        
        // Show a toast notification to remind users about in-memory storage
        toast({
          title: "PDF Uploaded",
          description: "The PDF is stored temporarily. Please complete your query now as the file will be unavailable after server restart.",
        });
        
        updateThread(activeThread.id, { 
          pdfFile: { id: fileId, name: fileName, previewUrl },
          isLoading: false
        });
      } catch (error) {
        console.error("PDF upload error:", error);
        toast({
          title: "Error",
          description: "Failed to upload the PDF. Please try again.",
          variant: "destructive",
        });
        updateThread(activeThread.id, { isLoading: false });
      }
    } else {
      toast({
        title: "Error",
        description: "Only PDF files are supported.",
        variant: "destructive",
      });
    }
  }, [activeThread, updateThread, toast]);

  return { handleSubmit, handleSearch, handleFileUpload };
};

// Main AIAssistant component
export function AIAssistant({ 
  className, 
  onChatChange, 
  onAddToChat, 
  selectedText: propSelectedText,
  onApplyEdit
}: AIAssistantProps) {
  const { width, startResizing } = useResizablePanel(400);
  const { 
    threads, 
    activeThread, 
    activeThreadId, 
    isLoading, 
    setActiveThreadId, 
    createNewChatThread, 
    updateThread, 
    deleteThread, 
    deleteAllChats 
  } = useChatThreads(onChatChange);
  const [selectedText, setSelectedText] = useState<string | undefined>();
  const [selectionInfo, setSelectionInfo] = useState<any>(undefined);
  
  // Sync the selectedText from props
  useEffect(() => {
    if (propSelectedText) {
      setSelectedText(propSelectedText);
    }
  }, [propSelectedText]);
  
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // We need to ensure activeThread is defined before passing to useChatOperations
  const chatOperations = useChatOperations(
    activeThread ?? null,  // Use nullish coalescing operator 
    updateThread
  );
  
  const { handleSubmit, handleSearch, handleFileUpload } = chatOperations;

  // Update thread title based on first message
  useEffect(() => {
    if (activeThread?.messages.length === 1 && activeThread.messages[0].role === 'user') {
      const title = activeThread.messages[0].content.slice(0, 30) + (activeThread.messages[0].content.length > 30 ? '...' : '');
      updateThread(activeThread.id, { title });
    }
  }, [activeThread, updateThread]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Auto-scroll for streaming
  useEffect(() => {
    if (activeThread?.currentResponse) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeThread?.currentResponse]);

  // Scroll for new messages
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom, activeThread?.messages]);

  const handleDeleteChat = useCallback((chatId: string) => {
    deleteThread(chatId);
  }, [deleteThread]);
  
  // Handle adding text from the editor to chat
  const handleAddToChat = useCallback((text: string, info: { startLine: number, endLine: number }) => {
    const selectionPreview = `Lines ${info.startLine}-${info.endLine}`;
    setSelectedText(text);
    setSelectionInfo(info);
    if (onAddToChat) {
      onAddToChat(text);
    }
  }, [onAddToChat]);

  return (
    <div 
      className={`bg-white flex overflow-hidden ${className}`} 
      style={{ width: `${width}px` }}
    >
      <div
        className="w-1 cursor-ew-resize hover:bg-gray-200 transition-colors"
        onMouseDown={startResizing}
        aria-label="Resize panel"
        role="separator"
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between h-12 px-4 border-b border-gray-200">
          <span className="text-[13px] text-gray-700 font-medium">AI Assistant (Gemini 2.0 Flash)</span>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-gray-500 hover:bg-gray-100"
              onClick={createNewChatThread}
              aria-label="New chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
            {threads.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 w-7"
                onClick={deleteAllChats}
                aria-label="Delete all chats"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <ChatThreadList 
              threads={threads} 
              setActiveThreadId={setActiveThreadId} 
              handleDeleteChat={handleDeleteChat}
            />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:bg-gray-100" aria-label="More options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Messages Area */}
        <div className="flex flex-col h-[calc(100vh-112px)]">
          <div className="flex-1 p-4 overflow-y-auto overflow-x-hidden w-full">
            <ChatMessages
              activeThread={activeThread ?? null}
              isLoading={isLoading}
              messagesEndRef={messagesEndRef}
              onApplyEdit={(text, editSelectionInfo) => {
                // This is where we handle applying the edit back to the editor
                toast({
                  title: "Applying edit",
                  description: "The AI's changes are being applied to the document.",
                });
                
                // Call the parent component's onApplyEdit function if available
                if (onApplyEdit) {
                  onApplyEdit(text, editSelectionInfo);
                  
                  // Show success toast
                  toast({
                    title: "Edit applied",
                    description: "The document has been updated with the AI's changes.",
                    variant: "default"
                  });
                } else {
                  console.log("No onApplyEdit handler available:", text, editSelectionInfo);
                  toast({
                    title: "Cannot apply edit",
                    description: "The edit function is not available.",
                    variant: "destructive"
                  });
                }
              }}
            />
          </div>
          
          {/* Input Area */}
          <div className="border-gray-200">
            <AIInputWithSearch
              placeholder={activeThread?.pdfFile 
                ? "Ask a question about the PDF..."
                : selectedText 
                  ? "Ask about the selected text..." 
                  : "Ask a question or upload a PDF..."}
              containerWidth={width}
              selectedText={selectedText}
              onClearSelectedText={() => setSelectedText(undefined)}
              onSubmit={async (value, withSearch) => {
                if (!activeThread) {
                  toast({
                    title: "Error",
                    description: "No active chat selected. Please try again.",
                    variant: "destructive",
                  });
                  return;
                }

                if (activeThread.isLoading) return;

                // If we have a PDF loaded, always use PDF flow regardless of search toggle
                if (activeThread.pdfFile) {
                  await handleSubmit(value);
                  return;
                }
                
                // If we have selected text, add it to the message
                if (selectedText) {
                  // Get the actual selection info or use default values
                  const startLine = selectionInfo?.startLine || 5;
                  const endLine = selectionInfo?.endLine || 15;
                  
                  // Create a message that includes the selected text
                  const newMessages: ExtendedMessage[] = [
                    { 
                      role: "user", 
                      content: value, 
                      type: "selected-text",
                      selectedText: selectedText,
                      selectionInfo: {
                        lines: `Lines ${startLine}-${endLine}`,
                        startLine: startLine,
                        endLine: endLine
                      }
                    }
                  ];
                  
                  // Update UI optimistically
                  updateThread(activeThread.id, { 
                    messages: [...activeThread.messages, ...newMessages],
                    isLoading: true,
                    currentResponse: "" 
                  });
                  
                  try {
                    // Save the message
                    const userResponse = await fetch(`/api/chats/${activeThread.id}/messages`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ messages: newMessages })
                    });
                    
                    if (!userResponse.ok) {
                      throw new Error('Failed to save user message');
                    }
                    
                    // Stream the chat response
                    let fullResponse = "";
                    await streamChat([...activeThread.messages, ...newMessages], (chunk) => {
                      fullResponse += chunk;
                      updateThread(activeThread.id, { currentResponse: fullResponse });
                    });
                    
                    // Save the assistant's response
                    const assistantMessage: ExtendedMessage = { 
                      role: "assistant", 
                      content: fullResponse,
                      type: "text"
                    };
                    
                    await fetch(`/api/chats/${activeThread.id}/messages`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ messages: [assistantMessage] })
                    });
                    
                    // Update UI
                    updateThread(activeThread.id, { 
                      messages: [...activeThread.messages, ...newMessages, assistantMessage],
                      currentResponse: "",
                      isLoading: false
                    });
                    
                    // Get the AI response as potential inline edit
                    const aiResponse = fullResponse.trim();
                    
                    // Function to detect if this is a direct text replacement (no markdown or explanations)
                    const isDirectReplacement = (text: string) => {
                      // Check if response doesn't have markdown code blocks, lists, headers, etc.
                      return !text.includes('```') && 
                             !text.includes('#') &&
                             !text.match(/^\d+\.|^\*|\[.*\]\(.*\)/m);
                    };
                    
                    // If this appears to be an inline edit, show apply button
                    if (isDirectReplacement(aiResponse)) {
                      // TODO: Add inline edit apply functionality here
                      console.log("This could be applied as an inline edit:", aiResponse);
                    }
                    
                    // Clear the selected text
                    setSelectedText(undefined);
                    
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to process your message. Please try again.",
                      variant: "destructive",
                    });
                    // Revert on error
                    updateThread(activeThread.id, { 
                      messages: activeThread.messages,
                      currentResponse: "",
                      isLoading: false
                    });
                  }
                  
                  return;
                }
                
                // Otherwise handle normal search/chat
                if (withSearch) {
                  await handleSearch(value);
                } else {
                  await handleSubmit(value);
                }
              }}
              onFileSelect={handleFileUpload}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
