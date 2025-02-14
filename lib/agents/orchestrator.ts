import { ResearcherAgent } from "./researcher-agent"
import { WriterAgent } from "./writer-agent"
import { ComplianceAgent } from "./compliance-agent"
import type { AgentMessage, TenderDocument, TenderSection } from "./types"

export class TenderOrchestrator {
  private researcherAgent: ResearcherAgent
  private writerAgent: WriterAgent
  private complianceAgent: ComplianceAgent
  private tender: TenderDocument

  constructor(tender: TenderDocument) {
    this.researcherAgent = new ResearcherAgent()
    this.writerAgent = new WriterAgent()
    this.complianceAgent = new ComplianceAgent()
    this.tender = tender
  }

  async processTenderSection(sectionTitle: string, requirements: string[]): Promise<TenderSection> {
    // Step 1: Research
    const researchMessage: AgentMessage = {
      role: "researcher",
      content: JSON.stringify({ requirements, context: this.tender }),
    }
    const researchResults = await this.researcherAgent.processMessage(researchMessage)

    // Step 2: Writing
    const writeMessage: AgentMessage = {
      role: "writer",
      content: JSON.stringify({
        research: researchResults.content,
        requirements,
        context: this.tender,
      }),
    }
    const writtenContent = await this.writerAgent.processMessage(writeMessage)

    // Step 3: Compliance Check
    const complianceMessage: AgentMessage = {
      role: "compliance",
      content: JSON.stringify({
        section: {
          title: sectionTitle,
          content: writtenContent.content,
          requirements,
        },
        tender: this.tender,
      }),
    }
    const complianceCheck = await this.complianceAgent.processMessage(complianceMessage)

    return {
      title: sectionTitle,
      content: writtenContent.content,
      requirements,
      status: complianceCheck.metadata?.passed ? "approved" : "review",
    }
  }

  async generateCompleteTender(): Promise<TenderDocument> {
    for (const section of this.tender.sections) {
      const processedSection = await this.processTenderSection(section.title, section.requirements)
      section.content = processedSection.content
      section.status = processedSection.status
    }

    return this.tender
  }
}

