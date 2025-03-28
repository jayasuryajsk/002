import { v4 as uuidv4 } from 'uuid';
import { TenderDocument, TenderSection, AgentMessage } from '../types';
import { DrafterAgent } from '../generation/drafter-agent';
import { ComplianceAgent } from '../generation/compliance-agent';
import { PlannerAgent } from '../generation/planner-agent';
import { AnalyzerAgent } from '../generation/analyzer-agent';
import { BaseAgent } from './base-agent';
import { LlamaCloudIndex, ContextChatEngine } from "llamaindex";

interface TenderGenerationOptions {
  title: string;
  prompt?: string;
  sections?: Array<{
    title: string;
    query?: string;
    requirements?: string[];
  }>;
  additionalContext?: string;
  maxIterations?: number;
  onProgress?: (message: string) => void;
}

interface GenerationResult {
  success: boolean;
  tender: TenderDocument;
  message?: string;
  stats?: {
    totalTime: number;
    iterations: Record<string, number>;
    agentCalls: Record<string, number>;
  };
}

/**
 * LlamaCloudOrchestrator - Coordinates multiple specialized agents to generate tender documents
 * Uses LlamaCloud for document retrieval and search
 */
export class LlamaCloudOrchestrator extends BaseAgent {
  private llamaCloudIndex: LlamaCloudIndex;
  private chatEngine: ContextChatEngine;
  private drafterAgent: DrafterAgent;
  private complianceAgent: ComplianceAgent;
  private plannerAgent: PlannerAgent;
  private analyzerAgent: AnalyzerAgent;
  private tender: TenderDocument | null = null;
  private tenderPlan: any = null;
  private isGenerating: boolean = false;
  private agentCalls: Record<string, number> = {};
  private sectionIterations: Record<string, number> = {};

  constructor() {
    super(
      "orchestrator",
      "You are a coordinator for tender preparation, managing the generation and assembly of tender response documents.",
      "gemini-2.0-flash-001",
    );

    // Initialize LlamaCloud components
    this.llamaCloudIndex = new LlamaCloudIndex({
      name: "companydocs",
      projectName: "Default",
      organizationId: process.env.LLAMA_CLOUD_ORG_ID || "",
      apiKey: process.env.LLAMA_CLOUD_API_KEY || "",
    });

    // Initialize retriever and chat engine
    const retriever = this.llamaCloudIndex.asRetriever({
      similarityTopK: 5,
    });
    this.chatEngine = new ContextChatEngine({ retriever });

    // Initialize other agents
    this.drafterAgent = new DrafterAgent();
    this.complianceAgent = new ComplianceAgent();
    this.plannerAgent = new PlannerAgent();
    this.analyzerAgent = new AnalyzerAgent();
  }

  /**
   * Generate a complete tender document based on the provided options
   */
  async generateTender(options: TenderGenerationOptions): Promise<TenderDocument> {
    if (this.isGenerating) {
      throw new Error("Already generating a tender document");
    }

    try {
      this.isGenerating = true;
      options.onProgress?.("Starting tender generation");

      // Initialize tender document
      this.tender = {
        id: uuidv4(),
        title: options.title,
        sections: [],
        compliance: {
          requirements: [],
          checklist: {}
        }
      };

      // Step 1: Retrieve and analyze source documents
      options.onProgress?.("Step 1: Retrieving and analyzing source documents");
      const sourceDocuments = await this.retrieveSourceDocuments(options.title);

      // Step 2: Extract requirements from source documents
      options.onProgress?.("Step 2: Extracting requirements from source documents");
      const requirements = await this.extractRequirements(sourceDocuments);

      // Step 3: Create tender plan
      options.onProgress?.("Step 3: Creating tender plan");
      this.tenderPlan = await this.createTenderPlan(
        options.prompt,
        requirements,
        options.additionalContext
      );

      // Step 4: Generate content for each section
      options.onProgress?.("Step 4: Generating content for each section");
      for (const section of this.tenderPlan.sections) {
        options.onProgress?.(`Generating section: ${section.title}`);
        const generatedSection = await this.generateSectionFromPlan(
          section,
          options.additionalContext,
          options.maxIterations
        );
        this.tender.sections.push(generatedSection);
      }

      return this.tender;
    } catch (error) {
      console.error("Error generating tender:", error);
      throw error;
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Retrieve source documents using LlamaCloud
   */
  private async retrieveSourceDocuments(query: string): Promise<any[]> {
    try {
      const response = await this.chatEngine.chat({
        message: `Find relevant documents for: ${query}`,
        stream: false
      });
      return response.sourceNodes || [];
    } catch (error) {
      console.error("Error retrieving source documents:", error);
      throw error;
    }
  }

  /**
   * Extract requirements from source documents using the AnalyzerAgent
   */
  private async extractRequirements(sourceDocuments: any[]): Promise<any[]> {
    try {
      const response = await this.analyzerAgent.processMessage({
        role: "orchestrator",
        content: JSON.stringify({
          action: "extractRequirements",
          documents: sourceDocuments
        })
      });

      const result = JSON.parse(response.content);
      return result.requirements || [];
    } catch (error) {
      console.error("Error extracting requirements:", error);
      throw error;
    }
  }

  /**
   * Create a tender plan using the PlannerAgent
   */
  private async createTenderPlan(
    prompt?: string,
    requirements: any[] = [],
    additionalContext?: string
  ): Promise<any> {
    try {
      const response = await this.plannerAgent.processMessage({
        role: "orchestrator",
        content: JSON.stringify({
          action: "createPlan",
          prompt,
          requirements,
          additionalContext
        })
      });

      const result = JSON.parse(response.content);
      return result.plan;
    } catch (error) {
      console.error("Error creating tender plan:", error);
      throw error;
    }
  }

  /**
   * Generate content for a specific section
   */
  private async generateSectionFromPlan(
    sectionPlan: {
      title: string;
      description: string;
      requirements: string[];
      relevantDocuments: string[];
    },
    additionalContext?: string,
    maxIterations: number = 2
  ): Promise<TenderSection> {
    console.log(`Generating section: ${sectionPlan.title}`);
    this.incrementAgentCalls("drafter");
    
    const sectionId = uuidv4();
    this.sectionIterations[sectionPlan.title] = 0;
    
    try {
      // Retrieve relevant documents using LlamaCloud
      const relevantDocs = await this.retrieveSourceDocuments(sectionPlan.title);
      
      // Use DrafterAgent for initial content generation
      const draftResponse = await this.drafterAgent.processMessage({
        role: "orchestrator",
        content: JSON.stringify({
          action: "generateSection",
          section: {
            ...sectionPlan,
            relevantDocuments: relevantDocs
          },
          additionalContext,
          iteration: this.sectionIterations[sectionPlan.title]
        })
      });

      const draftResult = JSON.parse(draftResponse.content);
      
      // Check compliance
      const complianceResponse = await this.complianceAgent.processMessage({
        role: "orchestrator",
        content: JSON.stringify({
          action: "checkCompliance",
          section: {
            title: sectionPlan.title,
            content: draftResult.content,
            requirements: sectionPlan.requirements
          }
        })
      });

      const complianceResult = JSON.parse(complianceResponse.content);
      
      return {
        id: sectionId,
        title: sectionPlan.title,
        content: draftResult.content,
        requirements: sectionPlan.requirements,
        compliance: complianceResult.compliance
      };
    } catch (error) {
      console.error(`Error generating section "${sectionPlan.title}":`, error);
      return {
        id: sectionId,
        title: sectionPlan.title,
        content: `Error generating content: ${error instanceof Error ? error.message : String(error)}`,
        requirements: sectionPlan.requirements
      };
    }
  }

  private incrementAgentCalls(agent: string) {
    this.agentCalls[agent] = (this.agentCalls[agent] || 0) + 1;
  }

  /**
   * Process a message - required for BaseAgent interface but not used
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    return {
      role: this.role,
      content: "The orchestrator does not process direct messages",
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }
} 