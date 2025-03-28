import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Loader2, File } from 'lucide-react';
import { PreviewAttachment } from './ui/PreviewAttachment';
import { Button } from './ui/button';
import { TenderWriterAgent } from '@/lib/agents/generation/tender-writer';
import { SourceDocument } from '@/lib/agents/types';
import { useToast } from './ui/use-toast';

interface SourcesProps {
  tenderAgent: TenderWriterAgent;
}

export const Sources = ({ tenderAgent }: SourcesProps) => {
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load sources on mount
  useEffect(() => {
    const baseUrl = window.location.origin;
    setIsLoading(true);
    
    fetch(`${baseUrl}/api/tender/sources?refresh=true`)
      .then(res => res.json())
      .then((sourcesData) => {
        setSources(sourcesData);
      })
      .catch(error => {
        console.error('Error loading source documents:', error);
        toast({
          title: 'Error Loading Documents',
          description: 'Failed to load source documents. Please try refreshing the page.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [toast]);

  // Handle source document file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files?.length) return

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
      });
      return;
    }

    setIsUploading(true);
    
    try {
      // Upload all valid files
      for (const file of validFiles) {
        await tenderAgent.addSourceDocument(file);
      }
      
      // Refresh sources list
      const baseUrl = window.location.origin;
      const response = await fetch(`${baseUrl}/api/tender/sources`);
      const updatedSources = await response.json();
      setSources(updatedSources);
      
      toast({
        title: "Success",
        description: `${validFiles.length} source document(s) uploaded successfully.`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Error adding source:', error);
      toast({
        title: "Error",
        description: "Failed to add source document(s).",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [tenderAgent, toast]);

  // Handle source document deletion
  const handleDelete = useCallback(async (id: string) => {
    try {
      const baseUrl = window.location.origin;
      await fetch(`${baseUrl}/api/tender/sources`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      setSources(prev => prev.filter(source => source.id !== id));
    } catch (error) {
      console.error('Error deleting source:', error);
      toast({
        title: "Error",
        description: "Failed to remove source document.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Handle clearing all source documents
  const handleClearAll = useCallback(async () => {
    // Confirm with the user
    if (!window.confirm("Are you sure you want to clear all documents? This action cannot be undone.")) {
      return;
    }
    
    try {
      setIsLoading(true);
      const baseUrl = window.location.origin;
      const response = await fetch(`${baseUrl}/api/tender/clear-all-docs`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error('Failed to clear documents');
      }

      // Reset the state immediately
      setSources([]);
      
      // Force a refresh from the server after a short delay
      setTimeout(async () => {
        try {
          const refreshResponse = await fetch(`${baseUrl}/api/tender/sources?refresh=true&t=${Date.now()}`);
          
          if (refreshResponse.ok) {
            const updatedSources = await refreshResponse.json();
            setSources(updatedSources);
          }
        } catch (refreshError) {
          console.error('Error refreshing sources:', refreshError);
        } finally {
          setIsLoading(false);
        }
      }, 500);

      toast({
        title: "Success",
        description: "All documents have been cleared.",
      });
    } catch (error) {
      console.error('Error clearing documents:', error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to clear documents.",
        variant: "destructive",
      });
    }
  }, [toast]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border/60 bg-card/50">
        <h2 className="text-sm font-medium text-foreground">Tender Requirements</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs shadow-subtle hover:shadow-card transition-all"
            disabled={isUploading}
            onClick={() => document.getElementById('tender-docs-upload')?.click()}
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
            id="tender-docs-upload"
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            accept="application/pdf,text/plain,.doc,.docx"
            disabled={isUploading}
            multiple
          />
          {sources.length > 0 && (
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
        ) : sources.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-40 border border-dashed border-border/60 rounded-lg bg-muted/20 text-center p-4 animate-fade-in">
            <div className="bg-muted/30 p-3 rounded-full mb-3">
              <File className="h-5 w-5 text-muted-foreground/70" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">No tender requirements uploaded</p>
            <p className="text-xs text-muted-foreground/70 max-w-xs">
              Upload PDF or text files containing tender requirements
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4 text-xs shadow-subtle" 
              onClick={() => document.getElementById('tender-docs-upload')?.click()}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Upload Requirements
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 animate-fade-in">
            {sources.map(source => (
              <div key={source.id} className="relative animate-slide-up">
                <PreviewAttachment
                  attachment={{
                    name: source.title,
                    url: `/api/files/${source.id}`,
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
    </div>
  );
}; 