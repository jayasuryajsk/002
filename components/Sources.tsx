import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Loader2, File } from 'lucide-react';
import { PreviewAttachment } from './ui/PreviewAttachment';
import { Button } from './ui/button';
import { TenderWriterAgent } from '@/lib/agents/tender-writer';
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
    
    fetch(`${baseUrl}/api/tender/sources`)
      .then(res => res.json())
      .then((sourcesData) => {
        setSources(sourcesData);
      })
      .catch(error => {
        console.error('Error loading source documents:', error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Handle source document file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.type.includes('text/')) {
      toast({
        title: "Invalid file type",
        description: "Only PDF and text files are supported.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      await tenderAgent.addSourceDocument(file);
      
      // Refresh sources list
      const baseUrl = window.location.origin;
      const response = await fetch(`${baseUrl}/api/tender/sources`);
      const updatedSources = await response.json();
      setSources(updatedSources);
    } catch (error) {
      console.error('Error adding source:', error);
      toast({
        title: "Error",
        description: "Failed to add source document.",
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
    try {
      const baseUrl = window.location.origin;
      const response = await fetch(`${baseUrl}/api/tender/clear-all-docs`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error('Failed to clear documents');
      }

      setSources([]);
    } catch (error) {
      console.error('Error clearing documents:', error);
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