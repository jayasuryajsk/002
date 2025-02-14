"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FolderOpen, GitFork, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function ProjectCreation() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const recentProjects = [
    "Highway Construction Tender 2024",
    "City Hospital Renovation",
    "Public School Development",
    "Solar Farm Installation",
    "Bridge Maintenance Project",
  ]

  const filteredProjects = recentProjects.filter((project) => project.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleOpenProject = async () => {
    setIsLoading(true)
    try {
      router.push("/tender")
    } catch (error) {
      console.error("Failed to open project:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#e4e4e7] flex items-center justify-start p-8 pl-200">
      <Card className="w-full max-w-xl border-0 bg-white/90 backdrop-blur-sm shadow-lg">
        <CardHeader className="space-y-1 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Tender Projects</h1>
          <p className="text-sm text-muted-foreground">Create or open tender projects</p>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={handleOpenProject}
            >
              <FolderOpen className="h-8 w-8" />
              <span>Open project</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => router.push("/tender/new")}
            >
              <GitFork className="h-8 w-8" />
              <span>New project</span>
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="space-y-1">
              {filteredProjects.map((project) => (
                <button
                  key={project}
                  className="w-full text-left px-2 py-1.5 rounded-sm text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                  onClick={() => router.push(`/tender/${encodeURIComponent(project)}`)}
                >
                  <div className="font-medium">{project}</div>
                </button>
              ))}
            </div>
            <Button
              variant="link"
              className="text-xs text-muted-foreground w-full"
              onClick={() => router.push("/tender/all")}
            >
              View all projects ({recentProjects.length})
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

