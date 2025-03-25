import { useState, useCallback, useEffect } from 'react'
import { PreviewAttachment } from './ui/PreviewAttachment'
import { Button } from './ui/button'
import { Upload, Plus, Trash2, FileIcon, Loader2 } from 'lucide-react'
import { SourceDocument } from '@/lib/agents/types'
import { TenderWriterAgent } from '@/lib/agents/tender-writer'
import { useToast } from './ui/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
} from "@/components/ui/card"

interface SourcesListProps {
  tenderAgent: TenderWriterAgent
}

export function SourcesList({ tenderAgent }: SourcesListProps) {
  const [sources, setSources] = useState<SourceDocument[]>([])
  const [companyDocs, setCompanyDocs] = useState<SourceDocument[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // Load sources and company documents on mount
  useEffect(() => {
    const baseUrl = window.location.origin
    
    setIsLoading(true)
    
    // Load both document types in parallel
    Promise.all([
      fetch(`${baseUrl}/api/tender/sources?refresh=true`).then(res => res.json()),
      fetch(`${baseUrl}/api/tender/company-docs?refresh=true`).then(res => res.json())
    ])
    .then(([sourcesData, companyDocsData]) => {
      setSources(sourcesData)
      
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

      setIsLoading(false)
    })
    .catch(err => {
      console.error('Error loading documents:', err)
      setIsLoading(false)
      toast({
        title: 'Error Loading Documents',
        description: 'Failed to load documents. Please try refreshing the page.',
        variant: 'destructive',
      })
    })
  }, [toast])

  // Handle source document file upload
  const handleSourceFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files?.length) return

    setIsUploading(true)
    try {
      // Check if we have valid files
      const validFiles = Array.from(files).filter(file => 
        file.type === 'application/pdf' || 
        file.type.includes('text/') || 
        file.name.endsWith('.doc') || 
        file.name.endsWith('.docx')
      )
      
      if (validFiles.length === 0) {
        toast({
          title: "Invalid file type",
          description: "Only PDF, DOC, DOCX and text files are supported.",
          variant: "destructive",
        })
        return
      }

      // Upload all valid files
      for (const file of validFiles) {
        await tenderAgent.addSourceDocument(file)
      }
      
      // Refresh sources list
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/tender/sources`)
      const updatedSources = await response.json()
      setSources(updatedSources)

      toast({
        title: "Success",
        description: `${validFiles.length} source document(s) added and saved to local storage.`,
        duration: 5000,
      })
    } catch (error) {
      console.error('Error adding source:', error)
      toast({
        title: "Error",
        description: "Failed to add source document(s).",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }, [tenderAgent, toast])

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

      toast({
        title: "Success",
        description: "Company documents uploaded successfully.",
        duration: 5000,
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
  }, [tenderAgent, toast])

  // Handle source document deletion
  const handleSourceDelete = useCallback(async (id: string) => {
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
  }, [toast])

  // Handle company document deletion
  const handleCompanyDocDelete = useCallback(async (id: string) => {
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
        description: "Company document removed successfully.",
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

  // Add a function to clear all documents
  const handleClearAll = useCallback(async () => {
    // Confirm with the user
    if (!window.confirm("Are you sure you want to clear all documents? This action cannot be undone.")) {
      return;
    }
    
    try {
      setIsLoading(true);
      const baseUrl = window.location.origin;
      const response = await fetch(`${baseUrl}/api/tender/clear-all-docs`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear documents');
      }

      // Reset the state directly
      setSources([]);
      setCompanyDocs([]);
      
      // Force a refresh from the server
      setTimeout(async () => {
        try {
          const [sourcesResponse, companyDocsResponse] = await Promise.all([
            fetch(`${baseUrl}/api/tender/sources?refresh=true&t=${Date.now()}`),
            fetch(`${baseUrl}/api/tender/company-docs?refresh=true&t=${Date.now()}`)
          ]);
          
          if (sourcesResponse.ok && companyDocsResponse.ok) {
            const updatedSources = await sourcesResponse.json();
            const updatedCompanyDocs = await companyDocsResponse.json();
            
            setSources(updatedSources);
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
            })));
          }
        } catch (refreshError) {
          console.error('Error refreshing documents:', refreshError);
        } finally {
          setIsLoading(false);
        }
      }, 500); // Short delay to ensure deletion has completed

      toast({
        title: "Success",
        description: "All documents have been cleared.",
      });
    } catch (error) {
      console.error('Error clearing all documents:', error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to clear all documents. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Document upload area component that works for both types
  const DocumentUploadArea = ({ type, acceptTypes, onChange }: { 
    type: 'source' | 'company', 
    acceptTypes: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void 
  }) => (
    <div className="border-2 border-dashed rounded-lg p-4">
      <div className="flex flex-col items-center justify-center gap-2">
        <Upload className="h-8 w-8 text-gray-400" />
        <p className="text-sm text-gray-500">
          {type === 'source' 
            ? 'Drag and drop tender documents and requirements here' 
            : 'Drag and drop your company capability documents here'}
        </p>
        <p className="text-xs text-gray-400">or</p>
        <Button 
          variant="outline" 
          size="sm"
          disabled={isUploading}
          onClick={() => document.getElementById(`${type}-docs-upload`)?.click()}
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
          id={`${type}-docs-upload`}
          type="file"
          multiple={true} // Allow multiple files for both document types
          className="hidden"
          onChange={onChange}
          accept={acceptTypes}
          disabled={isUploading}
        />
        <p className="text-xs text-gray-400 mt-2">
          {type === 'source' 
            ? 'PDF and text files supported. You can select multiple files.' 
            : 'Only PDF files are supported. You can select multiple files.'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-sm font-medium">Documents</h2>
        <div className="flex space-x-2">
          {(sources.length > 0 || companyDocs.length > 0) && (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleClearAll}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </div>
      
      <Tabs defaultValue="tender" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="tender">Tender Documents</TabsTrigger>
          <TabsTrigger value="company">Company Documents</TabsTrigger>
        </TabsList>
        
        {/* Tender Source Documents Tab */}
        <TabsContent value="tender" className="mt-2">
          <Card>
            <CardContent className="p-4 space-y-4">
              <CardDescription>
                Upload your tender requirements, RFP documents, and specifications
              </CardDescription>
              
              <DocumentUploadArea 
                type="source" 
                acceptTypes=".pdf,.txt,.doc,.docx" 
                onChange={handleSourceFileSelect} 
              />
              
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : sources.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  No tender documents added yet. Add tender requirements to reference in your proposal.
                </div>
              ) : (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Uploaded Tender Documents</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {sources.map(source => (
                      <div key={source.id} className="relative">
                        <PreviewAttachment
                          attachment={{
                            name: source.title,
                            url: source.metadata?.path || '',
                            contentType: source.metadata?.fileType
                          }}
                          onDelete={() => handleSourceDelete(source.id)}
                          isUploading={isUploading}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Company Documents Tab */}
        <TabsContent value="company" className="mt-2">
          <Card>
            <CardContent className="p-4 space-y-4">
              <CardDescription>
                Upload your company's capability documents, certifications, and portfolio
              </CardDescription>
              
              <DocumentUploadArea 
                type="company" 
                acceptTypes="application/pdf" 
                onChange={handleCompanyFileUpload} 
              />
              
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : companyDocs.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  No company documents uploaded yet. Add documents to showcase your capabilities.
                </div>
              ) : (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Uploaded Company Documents</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {companyDocs.map(doc => (
                      <div key={doc.id} className="relative">
                        <PreviewAttachment
                          attachment={{
                            name: doc.title,
                            url: doc.metadata?.path || '',
                            contentType: doc.metadata?.fileType
                          }}
                          onDelete={() => handleCompanyDocDelete(doc.id)}
                          isUploading={isUploading}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 