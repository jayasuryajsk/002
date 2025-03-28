import { FileText, Lightbulb, Tag, Sparkles, Filter, ArrowUp, ArrowDown } from "lucide-react"
import { useEffect, useState } from "react"
import { Note } from "@/lib/agents/generation/note-taking-agent"
import { cn } from "@/lib/utils"
import { ScrollArea } from "./ui/scroll-area"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { generateInsightsFromNotes } from "@/lib/note-service"
import { useToast } from "./ui/use-toast"

interface NotesListProps {
  conversationId?: string
}

export function NotesList({ conversationId }: NotesListProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<string | null>(null)
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sortOrder, setSortOrder] = useState<'newest' | 'importance'>('newest')
  const { toast } = useToast()

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

  // Subscribe to note updates
  useEffect(() => {
    if (!conversationId) return
    setLoading(true)
    setInsights(null)
    
    // Initial fetch
    fetchNotes().finally(() => setLoading(false))

    // Set up event source for real-time updates
    const eventSource = new EventSource(`/api/notes/${conversationId}/subscribe`)
    
    eventSource.onmessage = (event) => {
      const newNote = JSON.parse(event.data)
      setNotes(prev => [newNote, ...prev])
    }

    eventSource.onerror = (error) => {
      console.error('EventSource failed:', error)
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [conversationId])

  // Extract all unique categories from notes
  const categories = [...new Set(notes.filter(note => note.category).map(note => note.category))] as string[]

  // Filter notes by selected categories
  const filteredNotes = selectedCategories.length > 0
    ? notes.filter(note => !note.category || selectedCategories.includes(note.category))
    : notes

  // Sort notes based on current sort order
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (sortOrder === 'newest') {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    }
    
    // Sort by importance (high → medium → low)
    const importanceValues = { high: 3, medium: 2, low: 1, undefined: 0 }
    const importanceA = a.importance ? importanceValues[a.importance] : 0
    const importanceB = b.importance ? importanceValues[b.importance] : 0
    return importanceB - importanceA
  })

  // Generate project insights from accumulated notes
  const handleGenerateInsights = async () => {
    if (!conversationId || notes.length === 0) return
    
    setIsGeneratingInsights(true)
    
    try {
      const insights = await generateInsightsFromNotes(conversationId)
      setInsights(insights)
    } catch (error) {
      console.error('Failed to generate insights:', error)
      toast({
        title: "Error",
        description: "Failed to generate insights. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingInsights(false)
    }
  }

  // Get background color based on importance
  const getImportanceStyles = (importance?: 'high' | 'medium' | 'low') => {
    switch (importance) {
      case 'high':
        return 'border-amber-200 bg-amber-50'
      case 'medium':
        return 'border-blue-100 bg-blue-50'
      case 'low':
        return 'border-gray-200 bg-gray-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  // Get category badge color
  const getCategoryColor = (category?: string) => {
    if (!category) return 'bg-gray-200 hover:bg-gray-300'
    
    switch (category.toUpperCase()) {
      case 'DECISION':
        return 'bg-purple-200 hover:bg-purple-300 text-purple-800'
      case 'ACTION':
        return 'bg-red-200 hover:bg-red-300 text-red-800'
      case 'INSIGHT':
        return 'bg-blue-200 hover:bg-blue-300 text-blue-800'
      case 'REQUIREMENT':
        return 'bg-green-200 hover:bg-green-300 text-green-800'
      case 'REFERENCE':
        return 'bg-amber-200 hover:bg-amber-300 text-amber-800'
      case 'TECHNICAL':
        return 'bg-cyan-200 hover:bg-cyan-300 text-cyan-800'
      default:
        return 'bg-gray-200 hover:bg-gray-300 text-gray-800'
    }
  }

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-500" />
          <span className="text-[13px] font-medium text-gray-700">Smart Notes</span>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Generate Insights Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={notes.length === 0 || isGeneratingInsights}
            onClick={handleGenerateInsights}
          >
            {isGeneratingInsights ? (
              <>
                <Lightbulb className="h-3 w-3 animate-pulse" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                Insights
              </>
            )}
          </Button>
          
          {/* Sort Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSortOrder(sortOrder === 'newest' ? 'importance' : 'newest')}
            title={sortOrder === 'newest' ? 'Sort by newest first' : 'Sort by importance'}
          >
            {sortOrder === 'newest' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUp className="h-3 w-3" />
            )}
          </Button>
          
          {/* Category Filter */}
          {categories.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Filter by category">
                  <Filter className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs">Filter by Category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {categories.map(category => (
                  <DropdownMenuCheckboxItem
                    key={category}
                    checked={selectedCategories.includes(category)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCategories(prev => [...prev, category])
                      } else {
                        setSelectedCategories(prev => prev.filter(cat => cat !== category))
                      }
                    }}
                    className="text-xs"
                  >
                    {category}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        {/* Insights Panel */}
        {insights && (
          <div className="mb-4 p-3 rounded-md border border-blue-200 bg-blue-50">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-3 w-3 text-blue-600" />
              <h3 className="text-xs font-medium text-blue-800">AI Insights</h3>
            </div>
            <div className="prose prose-sm max-w-none text-[12px] text-blue-900">
              <div dangerouslySetInnerHTML={{ __html: insights }} />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-6 text-[10px] text-blue-700"
              onClick={() => setInsights(null)}
            >
              Dismiss
            </Button>
          </div>
        )}
        
        {loading ? (
          <p className="text-[13px] text-gray-600 leading-5 bg-gray-50 p-3 rounded-md border border-gray-100">
            Loading notes...
          </p>
        ) : sortedNotes.length === 0 ? (
          <p className="text-[13px] text-gray-600 leading-5 bg-gray-50 p-3 rounded-md border border-gray-100">
            No notes yet. Notes are automatically generated as you chat with important insights from both your questions and AI responses.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedNotes.map((note) => (
              <div
                key={note.id}
                className={cn(
                  "text-[13px] text-gray-600 leading-5 p-3 rounded-md border",
                  "transition-colors",
                  getImportanceStyles(note.importance)
                )}
              >
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: note.content }} />
                
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {note.category && (
                    <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", getCategoryColor(note.category))}>
                      {note.category}
                    </Badge>
                  )}
                  
                  {note.tags && note.tags.length > 0 && note.tags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 bg-white">
                      <Tag className="h-2 w-2 mr-0.5" />
                      {tag}
                    </Badge>
                  ))}
                </div>
                
                <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                  <span>{new Date(note.timestamp).toLocaleString()}</span>
                  {note.importance && (
                    <>
                      <span>•</span>
                      <span className={cn(
                        note.importance === 'high' ? 'text-amber-600' : 
                        note.importance === 'medium' ? 'text-blue-600' : 'text-gray-500'
                      )}>
                        {note.importance.charAt(0).toUpperCase() + note.importance.slice(1)} priority
                      </span>
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

