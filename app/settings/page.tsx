"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Upload, X, FileIcon, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { v4 as uuidv4 } from "uuid"

interface CompanyDocument {
  id: string
  name: string
  url: string
  contentType: string
}

export default function Settings() {
  const router = useRouter()
  const [projectName, setProjectName] = useState("")
  const [language, setLanguage] = useState("en")
  const [companyDocs, setCompanyDocs] = useState<CompanyDocument[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // Load existing company documents when the page loads
  useEffect(() => {
    const loadCompanyDocs = async () => {
      try {
        const baseUrl = window.location.origin
        const response = await fetch(`${baseUrl}/api/tender/company-docs`)
        if (!response.ok) {
          throw new Error('Failed to load company documents')
        }
        
        const docs = await response.json()
        setCompanyDocs(docs.map((doc: any) => ({
          id: doc.id,
          name: doc.title,
          url: doc.metadata?.path || '',
          contentType: doc.metadata?.fileType || 'application/pdf'
        })))
      } catch (error) {
        console.error('Error loading company documents:', error)
        toast({
          title: "Error",
          description: "Failed to load company documents.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadCompanyDocs()
  }, [toast])

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files?.length) return

    setIsUploading(true)
    
    try {
      // Filter for PDF files only
      const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf')
      
      if (pdfFiles.length === 0) {
        toast({
          title: "Invalid file type",
          description: "Only PDF files are supported.",
          variant: "destructive",
        })
        return
      }

      for (const file of pdfFiles) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("type", "company")

        const baseUrl = window.location.origin
        const response = await fetch(`${baseUrl}/api/tender/company-docs`, {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          throw new Error("Upload failed")
        }

        const { id, fileName } = await response.json()
        const previewUrl = URL.createObjectURL(file)
        
        setCompanyDocs(prev => [...prev, {
          id,
          name: fileName,
          url: previewUrl,
          contentType: file.type
        }])
      }

      toast({
        title: "Success",
        description: "Company documents uploaded successfully.",
      })
    } catch (error) {
      console.error("Document upload error:", error)
      toast({
        title: "Error",
        description: "Failed to upload documents. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }, [toast])

  const handleDelete = useCallback(async (id: string) => {
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/tender/company-docs?id=${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete document")
      }

      setCompanyDocs(prev => prev.filter(doc => doc.id !== id))
      toast({
        title: "Success",
        description: "Document removed successfully.",
      })
    } catch (error) {
      console.error("Error deleting document:", error)
      toast({
        title: "Error",
        description: "Failed to remove document. Please try again.",
        variant: "destructive",
      })
    }
  }, [toast])

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Navigation */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center h-14 px-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="ml-4 text-[15px] font-medium">Settings</h1>
        </div>
      </header>

      {/* Settings Content */}
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="space-y-6">
          {/* Project Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Project Settings</CardTitle>
              <CardDescription>
                Configure your project preferences and defaults
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Default Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Company Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Company Documents</CardTitle>
              <CardDescription>
                Upload your company's capability documents, certifications, and other internal documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyDocs">Company Documents</Label>
                <div className="border-2 border-dashed rounded-lg p-4">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Upload className="h-8 w-8 text-gray-400" />
                    <p className="text-sm text-gray-500">Drag and drop your PDF files here</p>
                    <p className="text-xs text-gray-400">or</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={isUploading}
                      onClick={() => document.getElementById('company-docs-upload')?.click()}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        'Browse Files'
                      )}
                    </Button>
                    <input
                      id="company-docs-upload"
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                      accept="application/pdf"
                      disabled={isUploading}
                    />
                    <p className="text-xs text-gray-400 mt-2">Only PDF files are supported</p>
                  </div>
                </div>
              </div>

              {/* Display uploaded documents */}
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : companyDocs.length > 0 ? (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Uploaded Documents</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {companyDocs.map((doc) => (
                      <div key={doc.id} className="relative flex items-center p-3 bg-gray-50 rounded-md">
                        <div className="flex items-center justify-center h-10 w-10 bg-white rounded-md border">
                          <FileIcon className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="ml-3 flex-1 overflow-hidden">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-gray-500">PDF Document</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-full"
                          onClick={() => handleDelete(doc.id)}
                        >
                          <X className="h-4 w-4 text-gray-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-sm text-gray-500">
                  No company documents uploaded yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Assistant Settings */}
          <Card>
            <CardHeader>
              <CardTitle>AI Assistant Settings</CardTitle>
              <CardDescription>
                Configure how the AI assistant behaves and assists you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="model">AI Model</Label>
                <Select defaultValue="gemini">
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Select AI model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="gpt4">GPT-4</SelectItem>
                    <SelectItem value="claude">Claude</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button>Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  )
} 