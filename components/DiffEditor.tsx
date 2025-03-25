import React, { useState } from 'react';
import { applyDiff } from '../lib/diffApplier';
import { useToast } from './ui/use-toast';
import { Button } from './ui/button';

interface DiffEditorProps {
  originalContent: string;
  onApply: (newContent: string) => void;
}

const DiffEditor: React.FC<DiffEditorProps> = ({ originalContent, onApply }) => {
  const [diffText, setDiffText] = useState('');
  const [previewContent, setPreviewContent] = useState('');
  const { toast } = useToast();

  const handlePreview = () => {
    try {
      const newContent = applyDiff(originalContent, diffText);
      setPreviewContent(newContent);
      toast({ title: 'Preview Successful', description: 'Diff applied successfully!' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to apply diff patch. Check your patch format.', variant: 'destructive' });
    }
  };

  const handleApply = () => {
    try {
      const newContent = applyDiff(originalContent, diffText);
      onApply(newContent);
      toast({ title: 'Success', description: 'Diff applied and content updated!' });
    } catch (error) {
      toast({ title: 'Apply Error', description: 'Failed to apply diff patch. Check your patch format.', variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-semibold">Diff Editor</h2>
      <textarea
        value={diffText}
        onChange={(e) => setDiffText(e.target.value)}
        placeholder="Paste your diff patch here..."
        className="w-full h-40 p-2 border border-gray-300 rounded-md"
      />
      <div className="flex space-x-4">
        <Button onClick={handlePreview} variant="default">Preview Diff</Button>
        <Button onClick={handleApply} variant="default">Apply Diff</Button>
      </div>
      {previewContent && (
        <div>
          <h3 className="text-xl font-medium mt-4">Preview of New Content:</h3>
          <pre className="p-2 bg-gray-100 rounded-md border border-gray-300 whitespace-pre-wrap break-words">{previewContent}</pre>
        </div>
      )}
    </div>
  );
};

export default DiffEditor;
