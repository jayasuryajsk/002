"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function NewProject() {
  const router = useRouter()
  const [projectName, setProjectName] = useState("")
  const [files, setFiles] = useState<FileList | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!projectName.trim()) {
      setError("Please enter a project name")
      return
    }

    setIsLoading(true)
    try {
      const formData = new FormData();
      formData.append('name', projectName);
      
      if (files) {
        Array.from(files).forEach(file => {
          formData.append('files', file);
        });
      }

      const response = await fetch('/api/projects', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      // Redirect to the project workspace
      router.push(`/project/${data.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#e4e4e7] flex items-center justify-start p-8 pl-200">
      <Card className="w-full max-w-xl border-0 bg-white/90 backdrop-blur-sm shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/create-project")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New Tender Project</h1>
            <p className="text-sm text-muted-foreground">Create a new tender project</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="files">Documents (optional)</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <input id="files" type="file" multiple onChange={handleFileChange} className="hidden" />
                <label htmlFor="files" className="cursor-pointer inline-flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to upload or drag and drop</span>
                </label>
              </div>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => router.push("/create-project")} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
