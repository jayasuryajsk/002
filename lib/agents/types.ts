export type AgentRole = "researcher" | "writer" | "compliance" | "reviewer" | "cost"

export interface AgentMessage {
  role: AgentRole
  content: string
  metadata?: Record<string, any>
}

export interface TenderSection {
  title: string
  content: string
  requirements: string[]
  status: "draft" | "review" | "approved"
}

export interface TenderDocument {
  id: string
  title: string
  sections: TenderSection[]
  budget?: {
    total: number
    breakdown: Record<string, number>
  }
  compliance: {
    requirements: string[]
    checklist: Record<string, boolean>
  }
}

