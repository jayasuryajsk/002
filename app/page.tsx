"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { ArrowLeft } from "lucide-react"
import { TenderMetadata } from "@/components/TenderMetadata"
import { NotesList } from "@/components/NotesList"
import { AIAssistant } from "@/components/AIAssistant"
import { SidebarToggle } from "@/components/SidebarToggle"
import { useRouter } from "next/navigation"
import { TipTapEditor } from "@/components/TipTapEditor"

export default function TenderWriterApp() {
  const [tenderTitle, setTenderTitle] = useState("")
  const [tenderContent, setTenderContent] = useState("")
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const router = useRouter()

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed)

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Navigation */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              onClick={() => router.push("/create-project")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h1 className="text-[15px] font-medium">{tenderTitle || "Untitled Tender"}</h1>
          </div>

          <div className="flex items-center gap-4">
            <TenderMetadata />

            <Button variant="ghost" size="sm" className="text-gray-500 hover:bg-gray-100 hover:text-gray-700">
              Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex h-[calc(100vh-56px)]">
        {/* Left Sidebar - Notes & Sources */}
        <div
          className={`border-r border-gray-200 bg-white transition-all duration-300 ease-in-out ${
            isSidebarCollapsed ? "w-[40px]" : "w-[280px]"
          } relative shadow-sm`}
        >
          <SidebarToggle isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
          <div className={`h-full transition-opacity duration-300 ${isSidebarCollapsed ? "opacity-0" : "opacity-100"}`}>
            <Tabs defaultValue="notes" className="h-full flex flex-col">
              <div className="flex items-center h-12 px-4 border-b border-gray-200">
                <TabsList className="grid w-full grid-cols-3 h-8 bg-gray-100 p-1 gap-1">
                  <TabsTrigger value="notes" className="text-[13px] h-6 data-[state=active]:bg-white">
                    Notes
                  </TabsTrigger>
                  <TabsTrigger value="sources" className="text-[13px] h-6 data-[state=active]:bg-white">
                    Sources
                  </TabsTrigger>
                  <TabsTrigger value="sections" className="text-[13px] h-6 data-[state=active]:bg-white">
                    Sections
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="notes" className="flex-1 overflow-auto">
                <NotesList conversationId={activeThreadId || undefined} />
              </TabsContent>

              <TabsContent value="sources" className="flex-1 overflow-auto">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[13px] font-medium text-gray-700">Sources</span>
                  </div>
                  <div className="text-[13px] text-gray-600 leading-5 bg-gray-50 p-3 rounded-md border border-gray-100">
                    No sources added yet. Add source documents to reference in your tender.
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="sections" className="flex-1 overflow-auto">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[13px] font-medium text-gray-700">Sections</span>
                  </div>
                  <div className="text-[13px] text-gray-600 leading-5 bg-gray-50 p-3 rounded-md border border-gray-100">
                    No sections created yet. Create sections to organize your tender content.
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Middle - Tender Composer */}
        <div className="bg-white flex flex-col h-full flex-grow border-r border-gray-200 shadow-sm">
          <div className="flex items-center h-12 px-4 border-b border-gray-200">
            <span className="text-[13px] text-gray-500 font-medium">Tender Composer</span>
          </div>
          <div className="flex flex-col flex-grow p-4 overflow-auto">
            <TipTapEditor
              content={tenderContent}
              onChange={setTenderContent}
              className="flex-grow"
              placeholder="Start typing..."
            />
          </div>
        </div>

        {/* Right Sidebar - AI Assistant */}
        <AIAssistant onChatChange={setActiveThreadId} />
      </div>
    </div>
  )
}

