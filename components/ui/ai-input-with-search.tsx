"use client";

import { Globe, Paperclip, Send, X } from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAutoResizeTextarea } from "@/components/hooks/use-auto-resize-textarea";
import { PreviewAttachment } from "./PreviewAttachment";

interface AIInputWithSearchProps {
  id?: string;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  onSubmit?: (value: string, withSearch: boolean) => void;
  onFileSelect?: (file: File) => void;
  className?: string;
  containerWidth?: number;
  selectedText?: string;
  onClearSelectedText?: () => void;
}

export function AIInputWithSearch({
  id = "ai-input-with-search",
  placeholder = "Search the web...",
  minHeight = 48,
  maxHeight = 164,
  onSubmit,
  onFileSelect,
  className,
  containerWidth,
  selectedText,
  onClearSelectedText
}: AIInputWithSearchProps) {
  const [value, setValue] = useState("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight,
    maxHeight,
  });
  const [showSearch, setShowSearch] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ file: File, url: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit?.(value, showSearch);
      setValue("");
      adjustHeight(true);
      setSelectedFile(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      // Create a temporary URL for preview
      const url = URL.createObjectURL(file);
      setSelectedFile({ file, url });
      
      if (onFileSelect) {
        await onFileSelect(file);
      }
      setIsUploading(false);
    }
  };

  const handleDeleteFile = () => {
    if (selectedFile) {
      URL.revokeObjectURL(selectedFile.url);
      setSelectedFile(null);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="relative mx-auto" style={{ maxWidth: containerWidth ? containerWidth : 'xl' }}>
        <div className="relative flex flex-col">
          {selectedFile && (
            <div className="px-4 py-2">
              <PreviewAttachment
                attachment={{
                  name: selectedFile.file.name,
                  url: selectedFile.url,
                  contentType: selectedFile.file.type
                }}
                onDelete={handleDeleteFile}
                isUploading={isUploading}
              />
            </div>
          )}
          
          {/* Selected Text Preview */}
          {selectedText && (
            <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-xs text-blue-700 font-medium mr-2">Selected Text (Lines 5-15):</span>
                <span className="text-xs text-blue-600 truncate max-w-[300px]">
                  {selectedText.length > 60 ? `${selectedText.substring(0, 60)}...` : selectedText}
                </span>
              </div>
              {onClearSelectedText && (
                <button 
                  onClick={onClearSelectedText}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          <div
            className="overflow-y-auto"
            style={{ maxHeight: `${maxHeight}px` }}
          >
            <Textarea
              id={id}
              value={value}
              placeholder={placeholder}
              className="w-full rounded-xl rounded-b-none px-4 py-3 bg-black/5 dark:bg-white/5 border-none dark:text-white placeholder:text-black/70 dark:placeholder:text-white/70 resize-none focus-visible:ring-0 leading-[1.2]"
              ref={textareaRef}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              onChange={(e) => {
                setValue(e.target.value);
                adjustHeight();
              }}
            />
          </div>

          <div className="h-12 bg-black/5 dark:bg-white/5 rounded-b-xl">
            <div className="absolute left-3 bottom-3 flex items-center gap-2">
              <label className="cursor-pointer rounded-lg p-2 bg-black/5 dark:bg-white/5">
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
                <Paperclip className="w-4 h-4 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors" />
              </label>
              <button
                type="button"
                onClick={() => setShowSearch(!showSearch)}
                className={cn(
                  "rounded-full transition-all flex items-center gap-2 px-1.5 py-1 border h-8",
                  showSearch
                    ? "bg-sky-500/15 border-sky-400 text-sky-500"
                    : "bg-black/5 dark:bg-white/5 border-transparent text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"
                )}
              >
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  <motion.div
                    animate={{
                      rotate: showSearch ? 180 : 0,
                      scale: showSearch ? 1.1 : 1,
                    }}
                    whileHover={{
                      rotate: showSearch ? 180 : 15,
                      scale: 1.1,
                      transition: {
                        type: "spring",
                        stiffness: 300,
                        damping: 10,
                      },
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 25,
                    }}
                  >
                    <Globe
                      className={cn(
                        "w-4 h-4",
                        showSearch
                          ? "text-sky-500"
                          : "text-inherit"
                      )}
                    />
                  </motion.div>
                </div>
                <AnimatePresence>
                  {showSearch && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{
                        width: "auto",
                        opacity: 1,
                      }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-sm overflow-hidden whitespace-nowrap text-sky-500 flex-shrink-0"
                    >
                      Search
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
            <div className="absolute right-3 bottom-3">
              <button
                type="button"
                onClick={handleSubmit}
                className={cn(
                  "rounded-lg p-2 transition-colors",
                  value
                    ? "bg-sky-500/15 text-sky-500"
                    : "bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 