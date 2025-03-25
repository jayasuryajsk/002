"use client"

// Diagnostic logs to identify import issues
console.log("--- DEBUGGING REACT IMPORTS ---");
import React from "react"; // Explicit default import
console.log("React imported:", typeof React !== "undefined");

import { useState, useEffect, useRef } from "react"
console.log("useState imported:", typeof useState !== "undefined");
console.log("useRef imported:", typeof useRef !== "undefined");
console.log("------------------");

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Loader2 } from "lucide-react"
import { TenderMetadata } from "@/components/TenderMetadata"
import { NotesList } from "@/components/NotesList"
import { AIAssistant } from "@/components/AIAssistant"
import { SidebarToggle } from "@/components/SidebarToggle"
import { useRouter, useSearchParams } from "next/navigation"
import { TipTapEditor } from "@/components/TipTapEditor"
import { Sources } from "@/components/Sources"
import { InternalDocs } from "@/components/InternalDocs"
import { TenderWriterAgent } from "@/lib/agents/tender-writer"
import { Editor } from '@tiptap/react'

export default function TenderWriterApp() {
  console.log("Component rendering - React available:", typeof React !== "undefined");
  console.log("Hooks available - useRef:", typeof useRef !== "undefined", "useState:", typeof useState !== "undefined");
  
  const [tenderTitle, setTenderTitle] = useState("")
  const [tenderContent, setTenderContent] = useState("")
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [selectedText, setSelectedText] = useState<string | undefined>()
  const editorRef = useRef<Editor | null>(null)
  const applyEditRef = useRef<{ applyEdit?: (from: number, to: number, newContent: string) => void }>()
  const [tenderAgent, setTenderAgent] = useState<TenderWriterAgent | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const chatId = searchParams.get('chatId')
    if (chatId) {
      setActiveThreadId(chatId)
    }
  }, [searchParams])

  // Initialize TenderWriterAgent
  useEffect(() => {
    if (editorRef.current) {
      console.log("Creating TenderWriterAgent with editor instance");
      setTenderAgent(new TenderWriterAgent(editorRef.current))
    }
  }, [editorRef.current])

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed)

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Top Navigation */}
      <header className="border-b border-border/60 bg-white shadow-subtle">
        <div className="flex items-center justify-between h-14 px-4 max-w-[1920px] mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => router.push("/create-project")}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>
            <h1 className="text-[15px] font-medium text-foreground">{tenderTitle || "Untitled Tender"}</h1>
          </div>

          <div className="flex items-center gap-4">
            <TenderMetadata />

            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground hover:text-foreground"
              onClick={() => router.push("/settings")}
            >
              Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex h-[calc(100vh-56px)] max-w-[1920px] mx-auto">
        {/* Left Sidebar - Notes & Sources */}
        <div
          className={`border-r border-border/60 bg-white transition-all duration-300 ease-in-out ${
            isSidebarCollapsed ? "w-[10px]" : "w-[350px]"
          } relative shadow-subtle`}
        >
          <SidebarToggle isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
          <div className={`h-full transition-opacity duration-300 ${isSidebarCollapsed ? "opacity-0 invisible" : "opacity-100 visible"}`}>
            <Tabs defaultValue="notes" className="h-full flex flex-col">
              <div className="flex items-center h-12 px-4 border-b border-border/60">
                <TabsList className="grid w-full grid-cols-3 h-8 bg-muted/60 p-1 gap-1 rounded-md">
                  <TabsTrigger value="notes" className="text-[13px] h-7 data-[state=active]:bg-white data-[state=active]:shadow-subtle">
                    Notes
                  </TabsTrigger>
                  <TabsTrigger value="sources" className="text-[13px] h-7 data-[state=active]:bg-white data-[state=active]:shadow-subtle">
                    Sources
                  </TabsTrigger>
                  <TabsTrigger value="sections" className="text-[13px] h-7 data-[state=active]:bg-white data-[state=active]:shadow-subtle">
                    Internal Docs
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="notes" className="flex-1 overflow-auto">
                <NotesList conversationId={activeThreadId || undefined} />
              </TabsContent>

              <TabsContent value="sources" className="flex-1 overflow-auto">
                {tenderAgent ? (
                  <Sources tenderAgent={tenderAgent} />
                ) : (
                  <div className="flex flex-col justify-center items-center h-40 text-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary/70 mb-2" />
                    <p className="text-sm text-muted-foreground">Initializing...</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sections" className="flex-1 overflow-auto">
                {tenderAgent ? (
                  <InternalDocs tenderAgent={tenderAgent} />
                ) : (
                  <div className="flex flex-col justify-center items-center h-40 text-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary/70 mb-2" />
                    <p className="text-sm text-muted-foreground">Initializing...</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Middle - Tender Composer */}
        <div className="bg-white flex flex-col h-full flex-grow border-r border-border/60 shadow-subtle">
          <div className="flex items-center h-12 px-4 border-b border-border/60 bg-card/50">
            <span className="text-[13px] text-muted-foreground font-medium">Tender Composer</span>
          </div>
          <div className="flex flex-col flex-grow p-5 overflow-auto">
            <TipTapEditor
              content={tenderContent}
              onChange={setTenderContent}
              className="flex-grow rounded-md border border-border/40 shadow-card"
              placeholder="Start typing your tender response..."
              onAddToChat={setSelectedText}
              applyEditRef={applyEditRef}
              editorRef={editorRef}
            />
          </div>
        </div>

        {/* Right Sidebar - AI Assistant */}
        <AIAssistant 
          onChatChange={setActiveThreadId} 
          selectedText={selectedText}
          onAddToChat={setSelectedText}
          onApplyEdit={(text, selectionInfo) => {
            // Connect AIAssistant to the editor
            if (applyEditRef.current?.applyEdit) {
              // Convert the parameters to match what the editor expects
              const from = selectionInfo?.startLine || 0;
              const to = selectionInfo?.endLine || 0;
              applyEditRef.current.applyEdit(from, to, text);
            }
          }}
        />
      </div>
    </div>
  )
}
