import { BaseAgent } from "./base-agent"
import type { AgentMessage, TenderDocument } from "./types"

export class ComplianceAgent extends BaseAgent {
  constructor() {
    super("compliance", "You are a tender compliance specialist. Ensure all requirements are met.")
  }

  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    const tender = JSON.parse(message.content) as TenderDocument

    const prompt = `
    Review the following tender document for compliance:
    ${JSON.stringify(tender, null, 2)}
    
    Check:
    1. All mandatory requirements are addressed
    2. Document structure follows guidelines
    3. Required certifications and documents
    4. Word/page limit compliance
    5. Format and submission requirements
    `

    const response = await this.generateResponse(prompt)

    return {
      role: this.role,
      content: response,
      metadata: {
        timestamp: new Date().toISOString(),
        type: "compliance_check",
        requirements: tender.compliance.requirements,
      },
    }
  }
}

