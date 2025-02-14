import { BaseAgent } from "./base-agent"
import type { AgentMessage } from "./types"

export class ResearcherAgent extends BaseAgent {
  constructor() {
    super("researcher", "You are a tender research specialist. Analyze requirements and gather relevant information.")
  }

  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    const prompt = `
    Analyze the following tender requirements and provide key research points:
    ${message.content}
    
    Include:
    1. Key requirements analysis
    2. Market research points
    3. Competitive advantages to highlight
    4. Potential risks and mitigation strategies
    `

    const response = await this.generateResponse(prompt)

    return {
      role: this.role,
      content: response,
      metadata: {
        timestamp: new Date().toISOString(),
        type: "research_analysis",
      },
    }
  }
}

