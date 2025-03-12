import { useState, useCallback, useEffect } from 'react'
import { PreviewAttachment } from './ui/PreviewAttachment'
import { Button } from './ui/button'
import { Plus, Trash2, Loader2, File } from 'lucide-react'
import { SourceDocument } from '@/lib/agents/types'
import { TenderWriterAgent } from '@/lib/agents/tender-writer'
import { useToast } from './ui/use-toast'

interface InternalDocsProps {
  tenderAgent: TenderWriterAgent
}

export function InternalDocs({ tenderAgent }: InternalDocsProps) {
  const [companyDocs, setCompanyDocs] = useState<SourceDocument[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // Load company documents on mount
  useEffect(() => {
    const baseUrl = window.location.origin
    
    // Load company documents
    fetch(`${baseUrl}/api/tender/company-docs`)
      .then(res => res.json())
      .then((companyDocsData) => {
        // Format company docs to match the SourceDocument structure
        setCompanyDocs(companyDocsData.map((doc: any) => ({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          binaryData: doc.binaryData,
          type: 'other',
          metadata: {
            dateAdded: doc.metadata?.dateAdded || new Date().toISOString(),
            fileType: doc.metadata?.fileType || 'application/pdf',
            fileSize: doc.metadata?.fileSize || 0,
            path: doc.metadata?.path || doc.title
          }
        })))
      })
      .catch(error => {
        console.error('Error loading company documents:', error)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  // Handle company document file upload
  const handleCompanyFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files?.length) return

    setIsUploading(true)
    
    try {
      // Filter for PDF files only
      const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf')
      
      if (pdfFiles.length === 0) {
        toast({
          title: "Invalid file type",
          description: "Only PDF files are supported for company documents.",
          variant: "destructive",
        })
        return
      }

      for (const file of pdfFiles) {
        await tenderAgent.addCompanyDocument(file)
      }
      
      // Refresh company docs list
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/tender/company-docs`)
      const updatedCompanyDocs = await response.json()
      
      setCompanyDocs(updatedCompanyDocs.map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        binaryData: doc.binaryData,
        type: 'other',
        metadata: {
          dateAdded: doc.metadata?.dateAdded || new Date().toISOString(),
          fileType: doc.metadata?.fileType || 'application/pdf',
          fileSize: doc.metadata?.fileSize || 0,
          path: doc.metadata?.path || doc.title
        }
      })))
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
  }, [tenderAgent, toast])

  // Handle company document deletion
  const handleCompanyDocDelete = useCallback(async (id: string) => {
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/tender/company-docs?id=${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error('Failed to delete company document')
      }

      setCompanyDocs(prev => prev.filter(doc => doc.id !== id))
    } catch (error) {
      console.error('Error deleting company document:', error)
      toast({
        title: "Error",
        description: "Failed to remove company document.",
        variant: "destructive",
      })
    }
  }, [toast])

  // Handle clearing all company documents
  const handleClearAll = useCallback(async () => {
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/tender/clear-all-docs`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error('Failed to clear documents')
      }

      setCompanyDocs([])
    } catch (error) {
      console.error('Error clearing documents:', error)
      toast({
        title: "Error",
        description: "Failed to clear documents.",
        variant: "destructive",
      })
    }
  }, [toast])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border/60 bg-card/50">
        <h2 className="text-sm font-medium text-foreground">Internal Documents</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs shadow-subtle hover:shadow-card transition-all"
            disabled={isUploading}
            onClick={() => document.getElementById('company-docs-upload')?.click()}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Upload
              </>
            )}
          </Button>
          <input
            id="company-docs-upload"
            type="file"
            multiple
            className="hidden"
            onChange={handleCompanyFileUpload}
            accept="application/pdf"
            disabled={isUploading}
          />
          {companyDocs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={handleClearAll}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear All
            </Button>
          )}
        </div>
      </div>
      
      <div className="p-4 flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex flex-col justify-center items-center h-40 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary/70 mb-2" />
            <p className="text-sm text-muted-foreground">Loading documents...</p>
          </div>
        ) : companyDocs.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-40 border border-dashed border-border/60 rounded-lg bg-muted/20 text-center p-4 animate-fade-in">
            <div className="bg-muted/30 p-3 rounded-full mb-3">
              <File className="h-5 w-5 text-muted-foreground/70" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">No documents uploaded</p>
            <p className="text-xs text-muted-foreground/70 max-w-xs">
              Upload PDF documents to include in your tender response
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4 text-xs shadow-subtle" 
              onClick={() => document.getElementById('company-docs-upload')?.click()}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Upload Documents
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 animate-fade-in">
            {companyDocs.map(doc => (
              <div key={doc.id} className="relative animate-slide-up">
                <PreviewAttachment
                  attachment={{
                    name: doc.title,
                    url: `/api/files/${doc.id}`,
                    contentType: doc.metadata?.fileType
                  }}
                  onDelete={() => handleCompanyDocDelete(doc.id)}
                  isUploading={isUploading}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 