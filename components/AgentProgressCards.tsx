import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

type AgentStatus = "idle" | "working" | "completed" | "error"

interface AgentProgress {
  name: string
  status: AgentStatus
  progress: number
  description: string
}

interface AgentProgressCardsProps {
  agents: AgentProgress[]
}

export function AgentProgressCards({ agents }: AgentProgressCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents.map((agent) => (
        <Card key={agent.name} className="w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{agent.name}</CardTitle>
            <Badge
              variant={
                agent.status === "completed" ? "success" : agent.status === "error" ? "destructive" : "secondary"
              }
            >
              {agent.status}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <Progress value={agent.progress} className="w-full" />
              <div className="text-sm font-medium">{agent.progress}%</div>
            </div>
            <CardDescription className="mt-2 text-xs">{agent.description}</CardDescription>
            {agent.status === "working" && (
              <div className="flex items-center justify-center mt-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

