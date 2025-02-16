import { FileText } from "lucide-react"
import { useEffect, useState } from "react"
import { Note } from "@/lib/agents/note-taking-agent"
import { cn } from "@/lib/utils"
import { ScrollArea } from "./ui/scroll-area"

interface NotesListProps {
  conversationId?: string
}

export function NotesList({ conversationId }: NotesListProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)

  // Function to fetch notes
  const fetchNotes = async () => {
    if (!conversationId) return
    
    try {
      const response = await fetch(`/api/notes/${conversationId}`)
      const data = await response.json()
      setNotes(data.notes)
    } catch (error) {
      console.error('Failed to fetch notes:', error)
    }
  }

  // Initial fetch when conversationId changes
  useEffect(() => {
    if (!conversationId) return
    setLoading(true)
    
    fetchNotes().finally(() => setLoading(false))
  }, [conversationId])

  // Poll for updates every 2 seconds
  useEffect(() => {
    if (!conversationId) return

    const interval = setInterval(fetchNotes, 2000)
    return () => clearInterval(interval)
  }, [conversationId])

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-gray-400" />
        <span className="text-[13px] font-medium text-gray-700">Notes</span>
      </div>
      
      <ScrollArea className="flex-1">
        {loading ? (
          <p className="text-[13px] text-gray-600 leading-5 bg-gray-50 p-3 rounded-md border border-gray-100">
            Loading notes...
          </p>
        ) : notes.length === 0 ? (
          <p className="text-[13px] text-gray-600 leading-5 bg-gray-50 p-3 rounded-md border border-gray-100">
            No notes yet. Notes will be automatically generated as you chat.
          </p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className={cn(
                  "text-[13px] text-gray-600 leading-5 p-3 rounded-md border",
                  "hover:border-gray-200 transition-colors"
                )}
              >
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: note.content }} />
                <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
                  <span>{new Date(note.timestamp).toLocaleString()}</span>
                  {note.category && (
                    <>
                      <span>•</span>
                      <span>{note.category}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

