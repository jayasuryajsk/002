import { useState, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { PreviewAttachment } from './ui/PreviewAttachment';

interface Source {
  name: string;
  url: string;
  contentType: string;
}

export const Sources = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    setUploading(true);
    
    try {
      // Here you would typically upload to your backend/storage
      // This is a mock implementation - replace with actual upload logic
      const newSources = Array.from(files).map(file => ({
        name: file.name,
        url: URL.createObjectURL(file),
        contentType: file.type
      }));

      setSources(prev => [...prev, ...newSources]);
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDelete = (index: number) => {
    setSources(prev => prev.filter((_, i) => i !== index));
  };

  // Chunk sources into groups of 3
  const sourceRows = sources.reduce((rows: Source[][], source, index) => {
    if (index % 3 === 0) {
      rows.push([source]);
    } else {
      rows[rows.length - 1].push(source);
    }
    return rows;
  }, []);

  return (
    <div className="p-4">
      <div className="flex items-center gap-4 mb-6">
        <label 
          htmlFor="file-upload"
          className="flex items-center gap-2 px-4 py-2 bg-white border rounded-md hover:bg-gray-50 cursor-pointer"
        >
          <Upload className="h-4 w-4" />
          <span>Upload Files</span>
        </label>
        <input
          id="file-upload"
          type="file"
          multiple
          className="hidden"
          onChange={handleFileUpload}
          accept="application/pdf,image/*"
        />
      </div>

      <div className="h-[calc(100%-4rem)] overflow-y-auto">
        <div className="flex flex-col gap-4">
          {sourceRows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-4">
              {row.map((source, index) => (
                <div key={`${source.name}-${rowIndex}-${index}`} className="flex-1">
                  <PreviewAttachment
                    attachment={source}
                    onDelete={() => handleDelete(rowIndex * 3 + index)}
                    isUploading={uploading}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 