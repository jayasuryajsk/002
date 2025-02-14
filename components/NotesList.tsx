import { FileText } from "lucide-react"

export function NotesList() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-gray-400" />
        <span className="text-[13px] font-medium text-gray-700">Notes</span>
      </div>
      <p className="text-[13px] text-gray-600 leading-5 bg-gray-50 p-3 rounded-md border border-gray-100">
        No notes yet. Start adding notes for your tender.
      </p>
    </div>
  )
}

