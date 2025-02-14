import { useState } from 'react';
import { Loader2, X, FileIcon } from 'lucide-react';

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

  return (
    <div className="flex flex-col">
      <div className="h-20 w-20 relative">
        {contentType?.includes('pdf') ? (
          <>
            {!hasError ? (
              <iframe
                src={`${url}#toolbar=0&view=FitH`}
                className="h-20 w-20"
                onLoad={() => {
                  setIsLoading(false);
                  setHasError(false);
                }}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
                style={{ border: 'none', background: 'white' }}
              >
                <FileIcon className="h-6 w-6" />
              </iframe>
            ) : (
              <div className="flex items-center justify-center h-20 w-20 bg-gray-100 text-gray-500">
                <FileIcon className="h-6 w-6" />
              </div>
            )}
            {(isUploading || isLoading) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/5 z-10">
                <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-20 w-20 bg-gray-100 text-gray-500">
            <FileIcon className="h-6 w-6" />
          </div>
        )}

        {!isUploading && onDelete && (
          <button
            onClick={onDelete}
            className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-sm border hover:bg-gray-100 z-20"
          >
            <X className="h-3 w-3 text-gray-500" />
          </button>
        )}
      </div>
      <div className="text-xs text-gray-500 max-w-16 truncate mt-1">{name}</div>
    </div>
  );
}; 