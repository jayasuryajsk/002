"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { ArrowLeft } from "lucide-react"
import { TenderMetadata } from "@/components/TenderMetadata"
import { NotesList } from "@/components/NotesList"
import { AIAssistant } from "@/components/AIAssistant"
import { SidebarToggle } from "@/components/SidebarToggle"
import { useRouter, useParams } from "next/navigation"
import { TipTapEditor } from "@/components/TipTapEditor"
import { prisma } from "@/lib/db"

export default function ProjectWorkspace() {
  const [projectName, setProjectName] = useState("")
  const [tenderContent, setTenderContent] = useState("")
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string

  useEffect(() => {
    // Load project data
    const loadProject = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        const data = await response.json();
        if (response.ok) {
          setProjectName(data.project.name);
          if (data.project.chats?.[0]) {
            setActiveThreadId(data.project.chats[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading project:', error);
      }
    };

    loadProject();
  }, [projectId]);

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
            <h1 className="text-[15px] font-medium">{projectName || "Untitled Project"}</h1>
          </div>

          <div className="flex items-center gap-4">
            <TenderMetadata />

            <Button variant="ghost" size="sm" className="text-gray-500 hover:bg-gray-100 hover:text-gray-700">
              Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Left Sidebar */}
        <div
          className={`border-r border-gray-200 bg-white transition-all duration-300 ${
            isSidebarCollapsed ? "w-0" : "w-80"
          }`}
        >
          <div className="flex h-full">
            <Tabs defaultValue="notes" className="flex-1">
              <div className="border-b border-gray-200 px-4 py-2">
                <TabsList className="w-full">
                  <TabsTrigger value="notes" className="flex-1">
                    Notes
                  </TabsTrigger>
                  <TabsTrigger value="files" className="flex-1">
                    Files
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="notes" className="flex-1 p-4">
                <NotesList />
              </TabsContent>

              <TabsContent value="files" className="flex-1 p-4">
                {/* Add file list component here */}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Main Editor */}
        <div className="flex-1 overflow-hidden">
          <div className="grid h-full" style={{ gridTemplateColumns: "1fr 400px" }}>
            <div className="border-r border-gray-200 overflow-auto">
              <div className="max-w-3xl mx-auto py-8 px-6">
                <TipTapEditor content={tenderContent} onChange={setTenderContent} />
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="bg-white overflow-auto">
              <div className="h-full">
                <AIAssistant 
                  projectId={projectId} 
                  activeThreadId={activeThreadId}
                  onThreadChange={setActiveThreadId}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Toggle */}
        <SidebarToggle isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
      </div>
    </div>
  )
}
