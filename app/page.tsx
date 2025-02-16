"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft } from "lucide-react"
import { TenderMetadata } from "@/components/TenderMetadata"
import { NotesList } from "@/components/NotesList"
import { AIAssistant } from "@/components/AIAssistant"
import { SidebarToggle } from "@/components/SidebarToggle"
import { useRouter } from "next/navigation"

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
          <div className={`transition-opacity duration-300 ${isSidebarCollapsed ? "opacity-0" : "opacity-100"}`}>
            <div className="flex items-center h-12 px-4 border-b border-gray-200">
              <Tabs defaultValue="notes" className="w-full">
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
              </Tabs>
            </div>
            <NotesList conversationId={activeThreadId || undefined} />
          </div>
        </div>

        {/* Middle - Tender Composer */}
        <div className="bg-white flex flex-col h-full flex-grow border-r border-gray-200 shadow-sm">
          <div className="flex items-center h-12 px-4 border-b border-gray-200">
            <span className="text-[13px] text-gray-500 font-medium">Tender Composer</span>
          </div>
          <div className="flex flex-col flex-grow p-4 overflow-auto">
            <Textarea
              placeholder="Start typing..."
              className="flex-grow text-[15px] border-none resize-none focus-visible:ring-0 p-0"
              value={tenderContent}
              onChange={(e) => setTenderContent(e.target.value)}
            />
          </div>
        </div>

        {/* Right Sidebar - AI Assistant */}
        <AIAssistant onChatChange={setActiveThreadId} />
      </div>
    </div>
  )
}

