import { useState, useCallback, useEffect } from 'react'
import { PreviewAttachment } from './ui/PreviewAttachment'
import { Button } from './ui/button'
import { Upload, Plus } from 'lucide-react'
import { SourceDocument } from '@/lib/agents/types'
import { TenderWriterAgent } from '@/lib/agents/tender-writer'
import { useToast } from './ui/use-toast'

interface SourcesListProps {
  tenderAgent: TenderWriterAgent
}

export function SourcesList({ tenderAgent }: SourcesListProps) {
  const [sources, setSources] = useState<SourceDocument[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

  // Load sources on mount
  useEffect(() => {
    const baseUrl = window.location.origin
    fetch(`${baseUrl}/api/tender/sources`)
      .then(res => res.json())
      .then(setSources)
      .catch(error => {
        console.error('Error loading sources:', error)
        toast({
          title: "Error",
          description: "Failed to load source documents.",
          variant: "destructive",
        })
      })
  }, [toast]) // Add toast to dependencies

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf' && !file.type.includes('text/')) {
      toast({
        title: "Invalid file type",
        description: "Only PDF and text files are supported.",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    try {
      await tenderAgent.addSourceDocument(file)
      
      // Refresh sources list
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/tender/sources`)
      const updatedSources = await response.json()
      setSources(updatedSources)

      toast({
        title: "Success",
        description: "Source document added successfully.",
      })
    } catch (error) {
      console.error('Error adding source:', error)
      toast({
        title: "Error",
        description: "Failed to add source document.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }, [tenderAgent])

  const handleDelete = useCallback(async (id: string) => {
    try {
      const baseUrl = window.location.origin
      await fetch(`${baseUrl}/api/tender/sources`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      setSources(prev => prev.filter(source => source.id !== id))
      toast({
        title: "Success",
        description: "Source document removed.",
      })
    } catch (error) {
      console.error('Error deleting source:', error)
      toast({
        title: "Error",
        description: "Failed to remove source document.",
        variant: "destructive",
      })
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-sm font-medium">Source Documents</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8"
          disabled={isUploading}
          onClick={() => document.getElementById('source-upload')?.click()}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <input
          id="source-upload"
          type="file"
          className="hidden"
          accept=".pdf,.txt,.doc,.docx"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
      </div>
      
      {sources.length === 0 ? (
        <div className="p-4 text-sm text-gray-500">
          No sources added yet. Add source documents to reference in your tender.
        </div>
      ) : (
        <div className="p-2 grid grid-cols-2 gap-2 auto-rows-max overflow-y-auto">
          {sources.map(source => (
            <div key={source.id} className="relative">
              <PreviewAttachment
                attachment={{
                  name: source.title,
                  url: source.metadata?.path || '',
                  contentType: source.metadata?.fileType
                }}
                onDelete={() => handleDelete(source.id)}
                isUploading={isUploading}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 