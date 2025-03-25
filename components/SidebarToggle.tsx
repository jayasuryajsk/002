import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface SidebarToggleProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function SidebarToggle({ isCollapsed, onToggle }: SidebarToggleProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`absolute ${isCollapsed ? "right-[-12px]" : "-right-3"} top-2 z-10 h-6 w-6 rounded-full border bg-white shadow-md`}
      onClick={onToggle}
    >
      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
    </Button>
  )
}
