import { useState } from 'react';
import { Loader2, X, FileIcon, File, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Attachment {
  name: string;
  url: string;
  contentType?: string;
}

export const PreviewAttachment = ({
  attachment,
  onDelete,
  isUploading = false,
}: {
  attachment: Attachment;
  onDelete?: () => void;
  isUploading?: boolean;
}) => {
  const { name, url, contentType } = attachment;
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const isPdf = contentType?.includes('pdf');
  const isImage = contentType?.includes('image');

  // Get file extension from name
  const fileExt = name.split('.').pop()?.toLowerCase() || '';

  return (
    <div className="group rounded-lg border border-border/40 bg-white p-3 shadow-sm hover:shadow transition-all duration-200 overflow-hidden">
      <div className="flex items-start gap-3">
        <div className="relative h-14 w-14 flex-shrink-0 rounded-md overflow-hidden border border-border/30 bg-muted/20">
          {isPdf && !hasError ? (
            <iframe
              src={`${url}#toolbar=0&view=FitH`}
              className="h-full w-full"
              onLoad={() => {
                setIsLoading(false);
                setHasError(false);
              }}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
              style={{ border: 'none', background: 'white' }}
            />
          ) : (
            <div className={cn(
              "flex items-center justify-center h-full w-full text-gray-500 transition-colors",
              hasError ? "bg-red-50" : "bg-muted/30"
            )}>
              {hasError ? (
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              ) : (
                <File className="h-6 w-6" />
              )}
            </div>
          )}
          {(isUploading || isLoading) && isPdf && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px] z-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0 py-0.5">
          <div className="text-sm font-medium text-foreground truncate">{name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center">
            <span className="inline-block px-1.5 py-0.5 bg-muted/50 rounded text-[10px] font-medium mr-1.5">
              {fileExt.toUpperCase()}
            </span>
            {hasError ? (
              <span className="text-red-500 text-[11px]">Failed to load</span>
            ) : (
              <span>Document</span>
            )}
          </div>
        </div>

        {!isUploading && onDelete && (
          <button
            onClick={onDelete}
            className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors rounded-full p-1 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Delete document"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}; 