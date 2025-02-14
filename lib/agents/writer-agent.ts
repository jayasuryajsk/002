import { BaseAgent } from "./base-agent"
import type { AgentMessage } from "./types"

export class WriterAgent extends BaseAgent {
  constructor() {
    super("writer", "You are a professional tender writer. Create compelling and compliant tender responses.")
  }

  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    const prompt = `
    Based on the research analysis, write a tender response section:
    ${message.content}
    
    Ensure:
    1. Clear and professional language
    2. Alignment with requirements
    3. Highlight unique value propositions
    4. Include relevant examples and credentials
    `

    const response = await this.generateResponse(prompt)

    return {
      role: this.role,
      content: response,
      metadata: {
        timestamp: new Date().toISOString(),
        type: "section_draft",
      },
    }
  }
}

