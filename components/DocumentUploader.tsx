'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from './ui/use-toast';

export function DocumentUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('source');
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Validate file size (10MB max)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: 'Please select a file smaller than 10MB.',
          variant: 'destructive',
        });
        return;
      }
      
      // Validate file type
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (!['pdf', 'docx', 'txt'].includes(fileExtension || '')) {
        toast({
          title: 'Unsupported File Type',
          description: 'Please select a PDF, DOCX, or TXT file.',
          variant: 'destructive',
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({
        title: 'No File Selected',
        description: 'Please select a file to upload.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsUploading(true);
    setResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', docType);
      
      const response = await fetch('/api/documents/index', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload document');
      }
      
      setResult(data);
      setFile(null); // Reset file input after successful upload
      
      // Reset the file input element
      const fileInput = document.getElementById('file') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
      toast({
        title: 'Document Indexed',
        description: `Successfully indexed ${data.fileName} into ${data.chunkCount} chunks.`,
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Indexing Failed',
        description: (error as Error).message || 'An unexpected error occurred',
        variant: 'destructive',
      });
      setResult({ error: (error as Error).message || 'An unexpected error occurred' });
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Document Uploader</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="docType">Document Type</Label>
          <Select 
            value={docType} 
            onValueChange={(value) => setDocType(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="source">Source Document</SelectItem>
              <SelectItem value="company">Company Document</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-gray-500">
            Source: tender documents, RFPs, etc. Company: profiles, capabilities, etc.
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="file">Upload File</Label>
          <Input 
            id="file"
            type="file" 
            onChange={handleFileChange} 
            accept=".pdf,.docx,.txt"
            className="cursor-pointer"
            disabled={isUploading}
          />
          <p className="text-sm text-gray-500">
            Supported formats: PDF, DOCX, TXT (max 10MB)
          </p>
        </div>
        
        <Button 
          type="submit" 
          disabled={!file || isUploading}
          className="w-full"
        >
          {isUploading ? 'Uploading & Indexing...' : 'Upload & Index Document'}
        </Button>
      </form>
      
      {result && (
        <div className="mt-6">
          <h3 className="font-medium mb-2">Processing Result:</h3>
          <div className="p-4 bg-gray-50 rounded-md overflow-auto max-h-40 text-sm">
            {result.error ? (
              <div className="text-red-500">{result.error}</div>
            ) : (
              <div className="space-y-1">
                <p><strong>File:</strong> {result.fileName}</p>
                <p><strong>ID:</strong> {result.fileId}</p>
                <p><strong>Chunks:</strong> {result.chunkCount}</p>
                <p><strong>Status:</strong> {result.success ? 'Success' : 'Failed'}</p>
                <p><strong>Type:</strong> {docType === 'source' ? 'Source Document' : 'Company Document'}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 