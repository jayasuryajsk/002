import React from 'react';
import * as Diff from 'diff';
import { Button } from './ui/button';

interface DiffPreviewProps {
  originalContent: string;
  newContent: string;
  onApply: () => void;
  onDiscard: () => void;
}

const DiffPreview: React.FC<DiffPreviewProps> = ({
  originalContent,
  newContent,
  onApply,
  onDiscard
}) => {
  // Generate word-level diff
  const diffResult = Diff.diffWords(originalContent, newContent);
  
  return (
    <div className="border rounded-md p-4 bg-white shadow-md">
      <div className="mb-2 font-medium text-gray-700">Changes Preview:</div>
      <div className="max-h-60 overflow-y-auto mb-4 p-3 bg-gray-50 rounded border">
        {diffResult.map((part, index) => {
          // Determine the styling based on whether text was added, removed, or unchanged
          const className = part.added 
            ? "text-green-700 bg-green-50" 
            : part.removed 
              ? "text-red-700 bg-red-50 line-through" 
              : "text-gray-800";
          
          return (
            <span key={index} className={className}>
              {part.value}
            </span>
          );
        })}
      </div>
      <div className="flex justify-between">
        <Button 
          onClick={onApply}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          Apply Changes
        </Button>
        <Button 
          onClick={onDiscard}
          variant="outline"
          className="border-gray-300 text-gray-700"
        >
          Discard
        </Button>
      </div>
    </div>
  );
};

export default DiffPreview;
