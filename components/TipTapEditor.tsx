import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import CodeBlock from '@tiptap/extension-code-block'
import Placeholder from '@tiptap/extension-placeholder'
// Re-enabling with non-functional version
import { Suggestions } from '@/lib/tiptap/suggestion'
import { TenderWriterAgent } from '@/lib/agents/tender-writer'
import { cn } from '@/lib/utils'
import {
  Bold,
  Italic,
  Underline,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Indent,
  Outdent,
  Image as ImageIcon,
  Table,
  Link as LinkIcon,
  FileText,
  MessageSquare,
  Loader2,
  Sparkles,
  Edit,
  ChevronUp,
  ChevronDown,
  ThumbsUp,
  PanelTopOpen,
  PanelBottomOpen,
  X,
  Code2,
  Wand2
} from "lucide-react"
import { Button } from './ui/button'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useToast } from "./ui/use-toast"
import { marked } from 'marked'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { DiffDecorationExtension } from '../lib/DiffDecorationExtension';
import DiffPreview from './DiffPreview';

// Function to convert markdown to HTML
function markdownToHtml(markdown: string): string {
  try {
    // Enhanced preprocessing to ensure proper markdown formatting
    let processedMarkdown = markdown
      // Ensure proper spacing after heading markers
      .replace(/^(#{1,6})([^#\s])/gm, '$1 $2')
      // Add extra newline before headings for better separation
      .replace(/^(#{1,6})/gm, '\n$1')
      // Ensure proper spacing after list markers
      .replace(/^(\s*[-*+])([^\s])/gm, '$1 $2')
      // Ensure space after ordered list markers
      .replace(/^(\s*\d+\.)([^\s])/gm, '$1 $2')
      // Add space between paragraphs if missing
      .replace(/([^\n])\n([^\n])/g, '$1\n\n$2')
      // Ensure proper spacing around horizontal rules
      .replace(/^---/gm, '\n\n---\n\n');
    
    // Use marked library to convert markdown to HTML with compatible options
    const html = marked.parse(processedMarkdown, {
      gfm: true,
      breaks: true
    }) as string;
    
    // Enhanced post-processing for better visual structure
    return html
      // Add strong visual hierarchy with spacing and typography
      .replace(/<h1/g, '<h1 class="text-3xl font-bold mt-8 mb-4 pb-2 border-b"')
      .replace(/<h2/g, '<h2 class="text-2xl font-bold mt-6 mb-3 pt-2"')
      .replace(/<h3/g, '<h3 class="text-xl font-semibold mt-5 mb-2"')
      // Improve list formatting
      .replace(/<ul>/g, '<ul class="list-disc pl-6 my-4 space-y-2">')
      .replace(/<ol>/g, '<ol class="list-decimal pl-6 my-4 space-y-2">')
      .replace(/<li>/g, '<li class="ml-2 pl-2">')
      // Improve paragraph spacing
      .replace(/<p>/g, '<p class="my-3">')
      // Add styling for blockquotes
      .replace(/<blockquote>/g, '<blockquote class="pl-4 border-l-4 border-gray-300 my-4 italic">')
      // Improve table formatting
      .replace(/<table>/g, '<table class="min-w-full border-collapse my-4">')
      .replace(/<th>/g, '<th class="border px-4 py-2 bg-gray-100 font-semibold">')
      .replace(/<td>/g, '<td class="border px-4 py-2">');
  } catch (error) {
    console.error('Error parsing markdown:', error);
    return markdown;
  }
}

// Interface representing a section of the tender document
interface TenderSection {
  id: string;
  title: string;
  content: string;
  level: 1 | 2 | 3;
  isExpanded?: boolean;
}

// Interface for the inline editing component
interface SectionEditorProps {
  section: TenderSection;
  editor: Editor;
  onUpdate: (section: TenderSection) => void;
  onClose: () => void;
}

// Popover menu for section editing actions
// Interface for the add to chat callback
interface AddToChat {
  (selectedText: string, selectionInfo: { startLine: number, endLine: number }): void;
}

const SectionEditor = ({ 
  section, 
  editor, 
  onUpdate, 
  onClose,
  addToChat 
}: SectionEditorProps & { addToChat?: AddToChat }) => {
  const { toast } = useToast();

  // Get the selected text and line numbers from editor
  const getSelectedTextInfo = () => {
    const { from, to } = editor.state.selection;
    if (from === to) return { text: "", startLine: 0, endLine: 0 };
    
    // Get the text content
    const text = editor.state.doc.textBetween(from, to);
    
    // Calculate line numbers
    const fromPos = editor.state.doc.resolve(from);
    const toPos = editor.state.doc.resolve(to);
    const startLine = getNodePath(fromPos)[0] + 1; // 1-indexed line numbers
    const endLine = getNodePath(toPos)[0] + 1;
    
    return { text, startLine, endLine };
  };

  // Send selected text to chat
  const handleAddToChat = () => {
    if (typeof addToChat !== 'function') {
      toast({
        title: "Chat function not available",
        description: "The chat function is not configured.",
        variant: "destructive"
      });
      return;
    }

    const { text, startLine, endLine } = getSelectedTextInfo();

    if (text) {
      addToChat(text, { startLine, endLine });
      onClose();
      toast({
        title: "Added to chat",
        description: "Selected text added to chat."
      });
    } else {
      toast({
        title: "No text selected",
        description: "Please select some text to add to chat.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex flex-col space-y-2 p-2">
      <div className="grid grid-cols-1 gap-2">
        {/* Add to Chat button */}
        <Button 
          size="sm" 
          variant="default" 
          className="text-xs flex items-center gap-1 bg-blue-500 text-white hover:bg-blue-600"
          onClick={handleAddToChat}
          disabled={!addToChat}
        >
          <MessageSquare className="h-3 w-3" />
          Add to Chat
        </Button>
      </div>
      
      <div className="pt-2 border-t mt-1">
        <Button 
          size="sm" 
          variant="ghost" 
          className="text-xs w-full flex items-center justify-center gap-1"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

interface TipTapEditorProps {
  content: string;
  onChange: (content: string) => void;
  className?: string;
  placeholder?: string;
  onAddToChat?: (selectedText: string, selectionInfo: { startLine: number, endLine: number }) => void;
  applyEditRef?: React.MutableRefObject<{
    applyEdit?: (newText: string, selectionInfo: { startLine: number, endLine: number }) => void
  } | undefined>;
  diffText?: string; // Optional diff patch to display diff decorations
  editorRef?: React.MutableRefObject<Editor | null>; // Reference to access the editor instance
}

export function TipTapEditor({
  content,
  onChange,
  className,
  placeholder = 'Start typing...',
  onAddToChat,
  applyEditRef,
  diffText,
  editorRef
}: TipTapEditorProps) {
  const [isAgentWriting, setIsAgentWriting] = useState(false)
  const [sections, setSections] = useState<TenderSection[]>([])
  const [pendingChanges, setPendingChanges] = useState<string | null>(null)
  const [originalContent, setOriginalContent] = useState<string>('')
  const [showPreview, setShowPreview] = useState(false)
  const [activeSection, setActiveSection] = useState<TenderSection | null>(null)
  const [showSectionMenu, setShowSectionMenu] = useState(false)
  const [sectionMenuPosition, setSectionMenuPosition] = useState({ x: 0, y: 0 })
  const editorRefInternal = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [generationProgress, setGenerationProgress] = useState<string>('')
  const [generationStage, setGenerationStage] = useState<string>('')
  const [showProgress, setShowProgress] = useState(false)
  
  // Store the last selection globally for context persistence
  const storeSelectionInWindow = useCallback((from: number, to: number, startLine: number, endLine: number) => {
    // @ts-ignore
    window.lastSelection = { from, to, startLine, endLine }
  }, [])
  
  // Parse the content to identify sections - client-side only
  const parseSections = useCallback((html: string): TenderSection[] => {
    // This function should only run on the client side
    if (typeof window === 'undefined') {
      return [];
    }

    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const sections: TenderSection[] = [];
    
    // Find all heading elements (h1, h2, h3)
    const headings = tempDiv.querySelectorAll('h1, h2, h3');
    
    headings.forEach((heading, index) => {
      // Determine the level of the heading
      const level = parseInt(heading.tagName.charAt(1)) as 1 | 2 | 3;
      const title = heading.textContent || `Section ${index + 1}`;
      
      // Find the content of this section (everything up to the next heading of the same or higher level)
      let content = '';
      let node = heading.nextSibling;
      
      // Collect all content until the next heading of the same or higher level
      while (node) {
        const isHeading = node.nodeType === 1 && 
                          ['H1', 'H2', 'H3'].includes((node as Element).tagName);
        
        if (isHeading) {
          const nextLevel = parseInt((node as Element).tagName.charAt(1));
          if (nextLevel <= level) {
            break;
          }
        }
        
        if (node.nodeType === 1) { // Element node
          content += (node as Element).outerHTML;
        } else if (node.nodeType === 3) { // Text node
          content += node.textContent;
        }
        
        node = node.nextSibling;
      }
      
      // Create section object
      sections.push({
        id: `section-${index}`,
        title,
        content: heading.outerHTML + content,
        level,
        isExpanded: true
      });
    });
    
    return sections;
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
          HTMLAttributes: {
            class: (attributes: { level: number }) => {
              // Add section ID for heading elements to make them identifiable
              const level = attributes.level;
              const baseClass = level === 1 
                ? 'text-3xl font-bold mt-8 mb-4 pb-2 border-b' 
                : level === 2 
                  ? 'text-2xl font-bold mt-6 mb-3 pt-2' 
                  : 'text-xl font-semibold mt-5 mb-2';
              return `${baseClass} section-heading`;
            }
          }
        },
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc pl-6 mb-4',
          }
        },
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal pl-6 mb-4',
          }
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 hover:text-blue-600 underline',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full',
        },
      }),
      CodeBlock.configure({
        HTMLAttributes: {
          class: 'bg-gray-100 rounded-md p-4 font-mono text-sm',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      // Using non-functional version of Suggestions extension
      Suggestions.configure({
        prediction: () => Promise.resolve(''),
      }),
      ...(diffText ? [DiffDecorationExtension.configure({ diffText, originalText: content })] : [])
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none h-full outline-none',
      },
      handleDOMEvents: {
        mouseup: () => {
          handleMouseUp();
          return false; // Let other handlers run
        }
      }
    },
    immediatelyRender: false,
  })
  
  // Update sections when content changes
  useEffect(() => {
    if (editor) {
      const html = editor.getHTML();
      const newSections = parseSections(html);
      setSections(newSections);
    }
  }, [editor, parseSections]);
  
  // Function to apply edits directly from chat - defined after editor initialization
  const applyChatEdit = useCallback((from: number, to: number, newContent: string) => {
    if (!editor) return;

    const docSize = editor.state.doc.nodeSize;

    // Validate the range
    if (from < 0 || to > docSize || from > to) {
      toast({
        title: "Error",
        description: "Selection range is out of bounds.",
        variant: "destructive"
      });
      return;
    }

    // Store the original content for later reference
    setOriginalContent(editor.getHTML());
    
    try {
      // First, create a temporary transaction to preview the changes
      // This will show the changes with red and green highlighting directly in the editor
      
      // Get the text to be replaced for showing in the diff preview
      const originalText = editor.state.doc.textBetween(from, to);
      
      // Create a div to insert into the editor that shows the diff preview
      const diffPreviewHTML = `
        <div class="p-3 space-y-2 my-2 bg-white rounded-md border border-gray-200 shadow-sm">
          <div class="bg-red-50 p-2 rounded-md border border-red-100">
            <div class="font-mono text-red-700 text-xs line-through">${originalText}</div>
          </div>
          <div class="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-4 w-4 text-gray-400"><path d="m6 9 6 6 6-6"></path></svg>
          </div>
          <div class="bg-green-50 p-2 rounded-md border border-green-100">
            <div class="font-mono text-green-700 text-xs">${newContent}</div>
          </div>
        </div>
      `;
      
      // Insert the diff preview at the selection position
      editor.chain()
        .focus()
        .setTextSelection({ from, to })
        .deleteSelection()
        .insertContent(diffPreviewHTML)
        .run();
      
      // Show controls to apply or discard changes
      setPendingChanges(editor.getHTML()); // Store the preview state
      setShowPreview(true);
      
    } catch (error) {
      console.error('Error applying chat edit preview:', error);
      toast({
        title: "Error",
        description: "Failed to preview the edit.",
        variant: "destructive"
      });
    }
  }, [editor, toast]);

  // Function to apply pending changes
  const applyPendingChanges = useCallback(() => {
    if (!editor || !pendingChanges) return;
    
    try {
      // Find and replace the diff preview div with the actual new content
      const content = editor.getHTML();
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      const diffPreviewDiv = doc.querySelector('.p-3.space-y-2.my-2');
      
      if (diffPreviewDiv) {
        // Get the new content from the green div
        const newContentElement = diffPreviewDiv.querySelector('.bg-green-50 .font-mono');
        const newContentText = newContentElement ? newContentElement.textContent || '' : '';
        
        // Find the position of the diff preview div in the editor
        const nodePos = editor.view.state.selection.$from;
        if (nodePos) {
          // Calculate the approximate length of the diff preview div
          const diffPreviewLength = diffPreviewDiv.textContent ? diffPreviewDiv.textContent.length : 0;
          
          // Replace the diff preview div with the new content
          editor.chain()
            .focus()
            .setTextSelection({ from: nodePos.pos, to: nodePos.pos + diffPreviewLength })
            .deleteSelection()
            .insertContent(newContentText)
            .run();
        }
      } else {
        // If we can't find the diff preview div, just apply the new content directly
        // This is a fallback method
        const cleanContent = pendingChanges.replace(/<div class="p-3 space-y-2 my-2.*?<\/div><\/div><\/div>/g, '');
        editor.commands.setContent(cleanContent);
      }
      
      toast({
        title: "Changes Applied",
        description: "The text has been updated."
      });
      
      // Clear pending changes and hide preview
      setPendingChanges(null);
      setShowPreview(false);
    } catch (error) {
      console.error('Error applying changes:', error);
      toast({
        title: "Error",
        description: "Failed to apply the changes.",
        variant: "destructive"
      });
    }
  }, [editor, pendingChanges, toast]);
  
  // Function to discard pending changes
  const discardPendingChanges = useCallback(() => {
    if (!editor || !originalContent) return;
    
    // Restore the original content
    editor.commands.setContent(originalContent);
    
    setPendingChanges(null);
    setShowPreview(false);
    
    toast({
      title: "Changes Discarded",
      description: "The changes have been discarded."
    });
  }, [editor, originalContent, toast]);

  // Expose the applyChatEdit function via ref for external access
  useEffect(() => {
    if (applyEditRef && editor) {
      applyEditRef.current = {
        applyEdit: (newText: string, selectionInfo: { startLine: number, endLine: number }) => {
          // Use a different approach to find positions based on line numbers
          try {
            // Get the current document
            const { doc } = editor.state;
            
            // Find positions based on line numbers
            let from = 1; // Default to start of document
            let to = doc.content.size; // Default to end of document
            
            // Try to find more precise positions if possible
            if (selectionInfo.startLine > 0 && selectionInfo.endLine > 0) {
              // Use a simplified approach - in a real implementation, you'd map line numbers to positions more carefully
              // This is just a basic approximation
              const startPos = Math.max(1, selectionInfo.startLine * 10); // Rough estimate
              const endPos = Math.min(doc.content.size, selectionInfo.endLine * 10); // Rough estimate
              
              if (startPos < endPos) {
                from = startPos;
                to = endPos;
              }
            }
            
            // Apply the edit using the character positions
            applyChatEdit(from, to, newText);
          } catch (error) {
            console.error("Error applying edit:", error);
            // Fallback to using current selection
            const { from: selFrom, to: selTo } = editor.state.selection;
            applyChatEdit(selFrom, selTo, newText);
          }
        }
      };
    }
    
    return () => {
      if (applyEditRef) {
        applyEditRef.current = undefined
      }
    }
  }, [editor, applyChatEdit, applyEditRef]);

  // Handle mouse selection to detect sections
  const handleMouseUp = useCallback(() => {
    if (!editor) return;
    
    // Use setTimeout to ensure the selection has fully processed
    setTimeout(() => {
      const { from, to } = editor.state.selection;
      if (from === to) return; // No selection
      
      // Get the selection text
      const selectedText = editor.state.doc.textBetween(from, to);
      if (!selectedText.trim()) return; // Skip empty selections
    
      // Always show the menu when there's a selection, regardless of sections
      // Calculate position for context menu
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Position the menu above the selection
        setSectionMenuPosition({
          x: rect.left + (rect.width / 2),
          y: rect.top - 10
        });
        
        // Create a temporary section to represent the selection
        setActiveSection({
          id: `selection-${Date.now()}`,
          title: "Selected Text",
          content: selectedText,
          level: 1
        });
        
        setShowSectionMenu(true);
      }
    }, 0); // zero timeout to ensure it runs after the browser's event loop
  }, [editor]);
  
  // Close the section menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editorRefInternal.current && !editorRefInternal.current.contains(event.target as Node)) {
        setShowSectionMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handler for updating a section
  const updateSection = useCallback((updatedSection: TenderSection) => {
    if (!editor) return;
    
    // Find the section in the editor
    const sectionElement = document.querySelector(`#${updatedSection.id}`);
    if (!sectionElement) return;
    
    // Get the position of the section
    const from = editor.view.posAtDOM(sectionElement, 0);
    const sectionIndex = sections.findIndex(s => s.id === updatedSection.id);
    const nextSectionPos = sectionIndex < sections.length - 1
      ? editor.view.posAtDOM(document.querySelector(`#${sections[sectionIndex + 1].id}`) as Element, 0)
      : editor.state.doc.content.size;
    
    // Replace the section content
    editor.chain()
      .focus()
      .deleteRange({ from, to: nextSectionPos })
      .insertContent(updatedSection.content)
      .run();
    
    // Update sections array
    setSections(prevSections => {
      const newSections = [...prevSections];
      newSections[sectionIndex] = updatedSection;
      return newSections;
    });
    
    // Close the section menu
    setShowSectionMenu(false);
  }, [editor, sections]);

  // Create a ref for the tender agent
  const tenderAgentRef = useRef<TenderWriterAgent | null>(null);
  
  // Initialize the tender agent when the editor is ready
  useEffect(() => {
    if (editor && !tenderAgentRef.current) {
      tenderAgentRef.current = new TenderWriterAgent(editor);
    }
    
    // Set up the applyEdit function for external components to use
    if (applyEditRef && editor) {
      applyEditRef.current = {
        applyEdit: (newText: string, selectionInfo: {startLine: number, endLine: number}) => {
          try {
            // Get the selection position if available
            const { from, to } = editor.state.selection;
            
            // If we have an active selection, use that
            if (from !== to) {
              editor.chain().focus().deleteRange({ from, to }).insertContent(newText).run();
            } else {
              // Otherwise use line numbers to find the content to replace
              // This is simplified - in a real implementation, you'd need to map line numbers to positions more carefully
              console.log("Applying edit with selection info:", selectionInfo);
              const lineFrom = selectionInfo.startLine;
              const lineTo = selectionInfo.endLine;
              
              // For demo, just replace the current selection (when available)
              editor.chain().focus().insertContent(newText).run();
            }
            
            console.log("Edit applied successfully");
            return true;
          } catch (error) {
            console.error("Error applying edit:", error);
            return false;
          }
        }
      };
    }
  }, [editor, applyEditRef]);

  const handleGenerateTender = async () => {
    if (!editor || !tenderAgentRef.current || isAgentWriting) return

    setIsAgentWriting(true)
    setShowProgress(true)
    setGenerationProgress('Initializing tender generation process...')
    setGenerationStage('Preparing')
    
    try {
      // Clear editor before starting to prevent initial message display
      editor.commands.clearContent()
      
      toast({
        title: "Generating Tender",
        description: "Processing your documents with Gemini Flash. This may take a few moments...",
      })
      
      // Base URL for API requests
      const baseUrl = window.location.origin;
      
      // Fetch latest source documents
      try {
        setGenerationProgress('Refreshing source documents...')
        const sourcesResponse = await fetch(`${baseUrl}/api/tender/sources?refresh=true`);
        const sourcesData = await sourcesResponse.json();
        console.log("Refreshed source documents before generation", sourcesData);
      } catch (sourceError) {
        console.error("Failed to refresh source documents:", sourceError);
      }
      
      // Fetch latest company documents
      try {
        setGenerationProgress('Refreshing company documents...')
        const companyDocsResponse = await fetch(`${baseUrl}/api/tender/company-docs?refresh=true`);
        const companyDocsData = await companyDocsResponse.json();
        console.log("Refreshed company documents before generation", companyDocsData);
      } catch (companyError) {
        console.error("Failed to refresh company documents:", companyError);
      }
      
      // Attempt to generate tender with more robust error handling
      try {
        setGenerationProgress('Starting tender generation...')
        setGenerationStage('Analyzing')
        
        const response = await fetch(`${baseUrl}/api/tender/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: editor.getText() || "Generate a comprehensive tender document with proper formatting and structure",
            hasCompanyContext: true
          })
        });

        if (!response.ok) {
          let errorMessage = `Failed to generate tender: ${response.status} ${response.statusText}`;
          
          try {
            const errorData = await response.json();
            console.error('Error response:', errorData);
            
            if (errorData.error) {
              errorMessage = errorData.error;
            }
            if (errorData.details) {
              console.error('Error details:', errorData.details);
            }
          } catch (parseError) {
            const textError = await response.text();
            console.error('Raw error response:', textError);
          }
          
          throw new Error(errorMessage);
        }

        console.log('Tender generation started, streaming response...')
        const reader = response.body?.getReader()
        if (!reader) throw new Error('No reader available')

        const decoder = new TextDecoder()
        let buffer = ''
        
        // Flag to track if we've received real content yet
        let hasRealContent = false
        
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) break
          
          const chunk = decoder.decode(value)
          buffer += chunk
          
          // Update progress display based on markdown headers
          if (chunk.includes('## Progress Update')) {
            const progressMatch = chunk.match(/## Progress Update\s+([\s\S]+?)(?=\n\n|\n##|$)/)
            if (progressMatch && progressMatch[1]) {
              setGenerationProgress(progressMatch[1].trim())
              
              // Update stage based on certain keywords
              if (progressMatch[1].includes('Analyzing')) {
                setGenerationStage('Analyzing')
              } else if (progressMatch[1].includes('Extracting')) {
                setGenerationStage('Planning')
              } else if (progressMatch[1].includes('Creating')) {
                setGenerationStage('Planning')
              } else if (progressMatch[1].includes('Generating')) {
                setGenerationStage('Writing')
              } else if (progressMatch[1].includes('Checking')) {
                setGenerationStage('Reviewing')
              } else if (progressMatch[1].includes('Finalizing')) {
                setGenerationStage('Finalizing')
              } else if (progressMatch[1].includes('Completed')) {
                setGenerationStage('Complete')
              }
            }
          }
          
          // Skip Gemini's initialization messages
          // These typically start with phrases like "I'm ready" or "Okay, I'm ready"
          if (!hasRealContent) {
            if (buffer.includes("Executive Summary") || 
                buffer.includes("## ") || 
                buffer.includes("# ") || 
                buffer.length > 200) {
              hasRealContent = true
              
              // Pre-process the buffer to ensure better formatting before showing
              buffer = buffer
                // Remove any potential preamble text before the first heading (without using 's' flag)
                .replace(/^[\s\S]*?(#)/, '$1')
                // Clean up any empty lines at the start
                .replace(/^\s+/, '')
                // Make sure to start with a proper heading
                .replace(/^(?!#)/, '# Executive Summary\n\n');
            } else if (buffer.includes("I'm ready") || 
                       buffer.includes("Okay,") ||
                       buffer.includes("ready to create") ||
                       buffer.includes("Please provide")) {
              // Just wait for more content without updating the editor
              continue;
            }
          }
          
          if (hasRealContent) {
            try {
              // Convert markdown to HTML before setting content
              const htmlContent = markdownToHtml(buffer)
              editor.commands.setContent(htmlContent)
            } catch (error) {
              console.error('Error rendering content:', error)
              // If rendering fails, try to show raw content
              editor.commands.setContent(`<p>Error rendering content. Raw data:</p><pre>${buffer}</pre>`)
            }
          }
        }
        
        toast({
          title: "Tender Generated",
          description: "Your tender document has been generated successfully.",
        })
      } catch (apiError) {
        console.error('API error during tender generation:', apiError);
        editor.commands.setContent(`<div class="p-4 text-red-500 border border-red-500 rounded-md mb-4">
          <h2 class="text-lg font-semibold mb-2">Error Generating Tender</h2>
          <p>${apiError instanceof Error ? apiError.message : 'An unexpected error occurred during tender generation.'}</p>
          <p class="mt-2">Possible causes:</p>
          <ul class="list-disc pl-5 mt-1">
            <li>Missing or invalid source documents</li>
            <li>Vector database connection issue</li>
            <li>API service unavailable</li>
          </ul>
          <p class="mt-2">Please check the browser console for detailed error logs.</p>
        </div>`);
        throw apiError;
      }
    } catch (error) {
      console.error('Error generating tender:', error)
      
      // Provide more specific error messages based on the error
      let errorMessage = "Failed to generate tender. Please try again."
      let errorTitle = "Error"
      
      if (error instanceof Error) {
        const errorText = error.message;
        
        if (errorText.includes('No source documents found')) {
          errorTitle = "Missing Source Documents"
          errorMessage = "The system couldn't find any source documents. This could happen if your uploaded documents weren't properly saved. Try refreshing the page and uploading your documents again."
        } else if (errorText.includes('API rate limit exceeded')) {
          errorTitle = "Rate Limit Exceeded"
          errorMessage = "The AI service is currently overloaded. Please wait a few minutes and try again."
        } else if (errorText.includes('API authentication error')) {
          errorTitle = "Authentication Error"
          errorMessage = "There's an issue with the AI service authentication. Please contact support."
        } else if (errorText.includes('No reader available')) {
          errorMessage = "Error processing the response. Please try again."
        } else if (errorText.includes('Failed to generate tender')) {
          // Extract the actual error message from the API response
          errorMessage = errorText.replace('Failed to generate tender: ', '')
        } else if (errorText.includes('token count')) {
          errorTitle = "Document Too Large"
          errorMessage = "Your documents are too large for processing. Try with smaller documents or fewer documents."
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      })
      
      // Update editor with error message in a formatted way
      editor?.commands.setContent(`
        <h1 class="text-2xl font-bold text-red-500 mb-4">Error</h1>
        <p class="mb-3">Failed to generate tender. Please try again.</p>
        <p class="mb-6">Please try again or modify your request.</p>
      `)
    } finally {
      setIsAgentWriting(false)
      // Keep progress visible for a moment after completion
      setTimeout(() => {
        setShowProgress(false)
      }, 3000)
    }
  }

  // Expose the editor instance through the provided ref
  useEffect(() => {
    if (editorRef && editor) {
      editorRef.current = editor;
    }
    return () => {
      if (editorRef) {
        editorRef.current = null;
      }
    };
  }, [editor, editorRef]);

  if (!editor) {
    return null
  }

  const toggleLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)

    if (url === null) {
      return
    }

    if (url === '') {
      editor.chain().focus().unsetLink().run()
      return
    }

    editor.chain().focus().setLink({ href: url }).run()
  }

  const addImage = () => {
    const url = window.prompt('URL')

    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  // Add a new function to handle direct tender generation
  const handleDirectGenerateTender = async () => {
    if (!editor || isAgentWriting) return

    setIsAgentWriting(true)
    setShowProgress(true)
    setGenerationProgress('Initializing direct tender generation process...')
    setGenerationStage('Preparing')
    
    try {
      // Clear editor before starting to prevent initial message display
      editor.commands.clearContent()
      
      toast({
        title: "Direct REST API Generation",
        description: "Using direct Gemini REST API with axios for document processing.",
      })
      
      // Base URL for API requests
      const baseUrl = window.location.origin;
      
      // Attempt to generate tender with direct approach
      try {
        setGenerationProgress('Making direct API call to Gemini...')
        setGenerationStage('Processing')
        
        const response = await fetch(`${baseUrl}/api/tender/direct-generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: editor.getText() || "Generate a comprehensive tender response addressing all requirements and highlighting company capabilities",
            title: "Tender Response Document"
          })
        });

        if (!response.ok) {
          let errorMessage = `Failed to generate tender: ${response.status} ${response.statusText}`;
          
          try {
            const errorData = await response.json();
            console.error('Error response:', errorData);
            
            if (errorData.error) {
              errorMessage = errorData.error;
            }
            if (errorData.details) {
              console.error('Error details:', errorData.details);
            }
          } catch (parseError) {
            const textError = await response.text();
            console.error('Raw error response:', textError);
          }
          
          throw new Error(errorMessage);
        }

        console.log('Direct tender generation started, streaming response...')
        const reader = response.body?.getReader()
        if (!reader) throw new Error('No reader available')

        const decoder = new TextDecoder()
        let buffer = ''
        let hasRealContent = false
        
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) break
          
          const chunk = decoder.decode(value)
          buffer += chunk
          
          // Update progress display based on markdown headers
          if (chunk.includes('## Progress Update')) {
            const progressMatch = chunk.match(/## Progress Update\s+([\s\S]+?)(?=\n\n|\n##|$)/)
            if (progressMatch && progressMatch[1]) {
              setGenerationProgress(progressMatch[1].trim())
            }
          }
          
          // Look for content that's not just progress updates
          if (!hasRealContent && chunk.includes('# Tender Response Document')) {
            hasRealContent = true
            setGenerationStage('Generated')
          }
          
          // Update the editor content with the response text
          // This creates a better UX by showing content as it arrives
          editor.commands.setContent(buffer)
        }

        // If we get here, the generation completed successfully
        setGenerationStage('Complete')
        toast({
          title: "Tender Generated Successfully",
          description: "Direct generation method using Gemini 2.0 Flash completed.",
          variant: "default",
        })
      } catch (error: any) {
        console.error('Error generating tender:', error)
        
        toast({
          title: "Error Generating Tender",
          description: error.message || "An unexpected error occurred",
          variant: "destructive",
        })
        
        editor.commands.setContent(`# Error Generating Tender\n\n${error.message || "An unexpected error occurred"}`)
      }
    } catch (error: any) {
      console.error('Error in generate handler:', error)
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsAgentWriting(false)
    }
  }

  // Add the button to the toolbar next to the existing Generate button
  const RenderMenuBar = ({ editor }: { editor: Editor }) => (
    <div className="flex flex-wrap items-center gap-1 p-1 bg-card rounded-t-md border-border/40 border-b-0 border">
      {/* Existing buttons... */}
      {/* ... */}
      
      {/* Add the direct generate button */}
      <Button
        variant="secondary"
        size="sm"
        className="gap-1 text-xs"
        disabled={isAgentWriting}
        onClick={handleDirectGenerateTender}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>Direct Generate (Gemini Flash)</span>
      </Button>
    </div>
  )

  return (
    <div className={cn("flex flex-col border rounded-md overflow-hidden", className)} ref={editorRefInternal}>
      {/* Changes controls - only shown when there are pending changes */}
      {showPreview && pendingChanges && (
        <div className="flex items-center justify-end gap-2 p-2 bg-gray-50 border-b">
          <span className="text-sm text-gray-600 mr-auto">Changes Preview</span>
          <Button 
            onClick={applyPendingChanges}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Apply Changes
          </Button>
          <Button 
            onClick={discardPendingChanges}
            size="sm"
            variant="outline"
            className="border-gray-300 text-gray-700"
          >
            Discard
          </Button>
        </div>
      )}
      <div className="flex items-center gap-1 p-1 border-b bg-white">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            'p-2 rounded hover:bg-gray-100',
            editor.isActive('bold') && 'bg-gray-100'
          )}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            'p-2 rounded hover:bg-gray-100',
            editor.isActive('italic') && 'bg-gray-100'
          )}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn(
            'p-2 rounded hover:bg-gray-100',
            editor.isActive('heading', { level: 1 }) && 'bg-gray-100'
          )}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            'p-2 rounded hover:bg-gray-100',
            editor.isActive('heading', { level: 2 }) && 'bg-gray-100'
          )}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            'p-2 rounded hover:bg-gray-100',
            editor.isActive('bulletList') && 'bg-gray-100'
          )}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            'p-2 rounded hover:bg-gray-100',
            editor.isActive('orderedList') && 'bg-gray-100'
          )}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={cn(
            'p-2 rounded hover:bg-gray-100',
            editor.isActive('codeBlock') && 'bg-gray-100'
          )}
          title="Code Block"
        >
          <Code className="h-4 w-4" />
        </button>
        <button
          onClick={toggleLink}
          className={cn(
            'p-2 rounded hover:bg-gray-100',
            editor.isActive('link') && 'bg-gray-100'
          )}
          title="Link"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
        <button
          onClick={addImage}
          className="p-2 rounded hover:bg-gray-100"
          title="Image"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerateTender}
          disabled={isAgentWriting}
          className="gap-2 text-xs font-medium"
        >
          {isAgentWriting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Generate Tender
            </>
          )}
        </Button>
        
        {/* Add Direct Generate button */}
        <Button 
          onClick={handleDirectGenerateTender}
          size="sm" 
          variant="secondary"
          className="mr-2"
          disabled={isAgentWriting}
        >
          {isAgentWriting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Direct Generate
            </>
          )}
        </Button>
        
        {showProgress && (
          <div className="ml-2 text-xs text-muted-foreground flex items-center">
            <span className="font-medium mr-1.5">{generationStage}:</span>
            <span className="truncate max-w-[220px]">{generationProgress}</span>
          </div>
        )}
        
        {/* Remove Help Text for Selection Feature */}
        <div className="ml-auto flex items-center">
          <Sparkles className="h-3 w-3 text-gray-400" />
        </div>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="h-full max-w-4xl mx-auto">
          <EditorContent editor={editor} className="h-full" />
          
          {/* Selection Action Popover */}
          {showSectionMenu && activeSection && (
            <div
              style={{
                position: 'absolute',
                left: `${sectionMenuPosition.x}px`,
                top: `${sectionMenuPosition.y}px`,
                transform: 'translateX(-50%)',
                zIndex: 50
              }}
            >
              <div className="bg-white border rounded shadow-sm">
                <button
                  className="px-3 py-1 text-sm hover:bg-gray-100"
                  onClick={() => {
                    if (onAddToChat) {
                      const { from, to } = editor.state.selection;
                      const selectedText = editor.state.doc.textBetween(from, to);
                      const fromPos = editor.state.doc.resolve(from);
                      const toPos = editor.state.doc.resolve(to);
                      const startLine = getNodePath(fromPos)[0] + 1;
                      const endLine = getNodePath(toPos)[0] + 1;
                      
                      // Store selection info for future reference
                      storeSelectionInWindow(from, to, startLine, endLine);
                      
                      onAddToChat(selectedText, {
                        startLine: startLine,
                        endLine: endLine
                      });
                    }
                    setShowSectionMenu(false);
                  }}
                >
                  Add to Chat
                </button>
              </div>
            </div>
          )}
          
          {/* Section Outline (Optional Feature - can be toggled on/off) */}
          {sections.length > 0 && (
            <div className="fixed right-4 top-1/2 transform -translate-y-1/2 bg-white border rounded-md shadow-sm p-2 w-48 max-h-[60vh] overflow-y-auto">
              <h3 className="text-xs font-medium text-gray-700 mb-2 flex items-center">
                <MessageSquare className="h-3 w-3 mr-1" />
                Document Outline
              </h3>
              <div className="space-y-1">
                {sections.map((section) => (
                  <div 
                    key={section.id}
                    className={cn(
                      "text-xs py-1 px-2 rounded cursor-pointer hover:bg-gray-100",
                      "transition-colors",
                      section.level === 1 ? "pl-2" : section.level === 2 ? "pl-4" : "pl-6"
                    )}
                    onClick={() => {
                      const sectionElement = document.querySelector(`#${section.id}`);
                      if (sectionElement) {
                        sectionElement.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    {section.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper function to safely access the path property of ResolvedPos
const getNodePath = (pos: any): number[] => {
  // Safely access the path property if it exists, otherwise return an empty array
  return pos && pos.path ? pos.path : [];
};