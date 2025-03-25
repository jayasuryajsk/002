export type AgentRole = 
  | "researcher" 
  | "writer" 
  | "compliance" 
  | "reviewer" 
  | "cost" 
  | "note-taking"
  | "retriever"
  | "drafter"
  | "orchestrator"
  | "quality"
  | "planner"
  | "analyzer"
  | "qa" // Question Answering agent

export interface AgentMessage {
  role: AgentRole
  content: string
  metadata?: Record<string, any>
}

export interface TenderRequirement {
  id: string
  description: string
  priority: "high" | "medium" | "low"
  category: string
}

export interface TenderSection {
  id: string
  title: string
  content: string
  requirements: string[]
  status?: "draft" | "review" | "approved"
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
  useCompanyDocs?: boolean
}

export interface DocumentMetadata {
  dateAdded: string;
  fileType: string;
  fileSize: number;
  path: string;
  blobUrl?: string;
  storageKey?: string;
  [key: string]: any; // Allow for additional properties
}

export interface SourceDocument {
  id: string;
  title: string;
  content: string;
  type: string;
  binaryData?: Uint8Array | null;
  metadata?: DocumentMetadata;
}

export interface CompanyDocument {
  id: string;
  title: string;
  content: string;
  type: string;
  binaryData?: Uint8Array | null;
  metadata?: DocumentMetadata;
}

export interface DocumentSummary {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  originalDocumentId: string;
}

