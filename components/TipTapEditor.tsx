import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import CodeBlock from '@tiptap/extension-code-block'
import Placeholder from '@tiptap/extension-placeholder'
import { Suggestions } from '@/lib/tiptap/suggestion'
import { TenderWriterAgent } from '@/lib/agents/tender-writer'
import { cn } from '@/lib/utils'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Heading1,
  Heading2,
  Wand2,
  Loader2
} from 'lucide-react'
import { Button } from './ui/button'
import { useState } from 'react'
import { useToast } from './ui/use-toast'
import { marked } from 'marked'

// Function to convert markdown to HTML
function markdownToHtml(markdown: string): string {
  try {
    return marked.parse(markdown) as string;
  } catch (error) {
    console.error('Error parsing markdown:', error);
    return markdown;
  }
}

interface TipTapEditorProps {
  content: string
  onChange: (content: string) => void
  className?: string
  placeholder?: string
}

export function TipTapEditor({
  content,
  onChange,
  className,
  placeholder = 'Start typing...',
}: TipTapEditorProps) {
  const [isAgentWriting, setIsAgentWriting] = useState(false)
  const { toast } = useToast()
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
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
      Suggestions.configure({
        prediction: async (text: string): Promise<string> => {
          if (isAgentWriting) return ''
          if (text.length < 3) return ''
          
          try {
            const baseUrl = window.location.origin
            const response = await fetch(`${baseUrl}/api/predict`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ text }),
            })

            if (!response.ok) {
              throw new Error('Failed to get predictions')
            }

            const prediction = await response.json()
            return prediction
          } catch (error) {
            console.error('Error getting predictions:', error)
            return ''
          }
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none h-full outline-none',
      },
    },
    immediatelyRender: false,
  })

  const [tenderAgent] = useState(() => new TenderWriterAgent(editor))

  const handleGenerateTender = async () => {
    if (!editor || isAgentWriting) return

    setIsAgentWriting(true)
    try {
      // Skip all checks and directly call the API
      toast({
        title: "Generating Tender",
        description: "Processing your documents one by one with Gemini Flash. This may take a few moments...",
      })
      
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/tender/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: editor.getText() || "Generate a comprehensive tender document"
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to generate tender: ${response.status} ${response.statusText}`, errorText)
        throw new Error(`Failed to generate tender: ${errorText}`)
      }

      console.log('Tender generation started, streaming response...')
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value)
        buffer += chunk

        // Convert markdown to HTML before setting content
        const htmlContent = markdownToHtml(buffer)
        editor.commands.setContent(htmlContent)
      }
      
      toast({
        title: "Tender Generated",
        description: "Your tender has been generated using summaries from your company documents.",
      })
    } catch (error) {
      console.error('Error generating tender:', error)
      
      // Provide more specific error messages based on the error
      let errorMessage = "Failed to generate tender. Please try again."
      let errorTitle = "Error"
      
      if (error instanceof Error) {
        const errorText = error.message;
        
        if (errorText.includes('API rate limit exceeded')) {
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
    } finally {
      setIsAgentWriting(false)
    }
  }

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

  return (
    <div className={cn("flex flex-col border rounded-md overflow-hidden", className)}>
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
          onClick={handleGenerateTender}
          className={cn(
            'p-2 rounded hover:bg-gray-100 gap-2',
            isAgentWriting && 'bg-blue-50 text-blue-600'
          )}
          disabled={isAgentWriting}
          title="Generate Tender with Gemini Flash"
        >
          <Wand2 className="h-4 w-4" />
          {isAgentWriting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Generate Smart Tender'
          )}
        </Button>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="h-full max-w-4xl mx-auto">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>
    </div>
  )
} 