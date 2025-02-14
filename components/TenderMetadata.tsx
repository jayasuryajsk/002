import { Clock } from "lucide-react"

export function TenderMetadata() {
  return (
    <div className="flex items-center gap-4 text-[13px] text-gray-500">
      <div className="flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" />
        <span>Last saved · --:-- --</span>
      </div>
    </div>
  )
}

