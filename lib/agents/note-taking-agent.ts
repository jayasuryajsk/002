import { BaseAgent } from "./base-agent"
import type { AgentMessage } from "./types"

export interface Note {
  id: string
  content: string
  timestamp: string
  category?: string
  tags?: string[]
  source: {
    type: 'conversation'
    messageId: string
  }
}

export class NoteTakingAgent extends BaseAgent {
  constructor() {
    super(
      "note-taking",
      "You are a professional note-taking assistant. Your task is to create extremely concise 1-2 sentence notes that capture the most important information."
    )
  }

  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    const prompt = `
    Analyze the following conversation and create an extremely concise note:
    ${message.content}
    
    Rules:
    1. The note MUST be only 1-2 sentences long
    2. Focus only on the most important information, decisions, or action items
    3. Use clear, direct language
    4. Avoid any unnecessary details or context
    5. Do not use markdown formatting
    
    Example good notes:
    - "Decided to use Redis for real-time stock updates in the new wishlist feature, targeting Q2 completion."
    - "Need to hire 3 senior developers by end of Q3, budget approved at $150k per role."
    `

    const response = await this.generateResponse(prompt)

    return {
      role: this.role,
      content: response,
      metadata: {
        timestamp: new Date().toISOString(),
        type: "conversation_notes",
      }
    }
  }

  async summarizeNotes(notes: Note[]): Promise<string> {
    const prompt = `
    Review and summarize the following collection of notes:
    ${JSON.stringify(notes, null, 2)}
    
    Create a concise summary that:
    1. Highlights the most important points
    2. Groups related information
    3. Identifies any patterns or themes
    4. Lists outstanding action items
    
    Format the summary in markdown.
    `

    const response = await this.generateResponse(prompt)
    return response
  }
} 