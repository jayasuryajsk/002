import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import CodeBlock from '@tiptap/extension-code-block'
import Placeholder from '@tiptap/extension-placeholder'
import { Suggestions } from '@/lib/tiptap/suggestion'
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
} from 'lucide-react'

interface TipTapEditorProps {
  content: string
  onChange: (content: string) => void
  className?: string
  placeholder?: string
}

// Function to get predictions from an API
const getPredictions = async (text: string): Promise<string> => {
  if (text.length < 3) return ''
  
  try {
    const response = await fetch('/api/predict', {
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
}

export function TipTapEditor({
  content,
  onChange,
  className,
  placeholder = 'Start typing...',
}: TipTapEditorProps) {
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
        prediction: getPredictions,
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
    <div className={cn('h-full flex flex-col', className)}>
      <div className="border-b p-2 flex gap-1 flex-wrap bg-gray-50">
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
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="h-full max-w-4xl mx-auto">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>
    </div>
  )
} 