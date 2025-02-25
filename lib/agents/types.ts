export type AgentRole = "researcher" | "writer" | "compliance" | "reviewer" | "cost" | "note-taking"

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

export interface SourceDocument {
  id: string
  title: string
  content: string
  binaryData?: Uint8Array | null
  type: "requirements" | "specifications" | "addendum" | "other"
  metadata?: {
    dateAdded: string
    fileType: string
    fileSize: number
    path: string
  }
}

