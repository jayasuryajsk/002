import { v4 as uuidv4 } from 'uuid';
import { TenderDocument, TenderSection, AgentMessage, SourceDocument, CompanyDocument } from '../types';
import { RetrieverAgent } from '../search/retriever-agent';
import { DrafterAgent } from '../generation/drafter-agent';
import { ComplianceAgent } from '../generation/compliance-agent';
import { PlannerAgent } from '../generation/planner-agent';
import { AnalyzerAgent } from '../generation/analyzer-agent';
import { BaseAgent } from './base-agent';
import { LocalDocumentStorage } from '@/lib/local-storage';

interface TenderGenerationOptions {
  title: string;
  prompt?: string;
  sections?: Array<{
    title: string;
    query?: string;
    requirements?: string[];
  }>;
  companyContext?: string;
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

interface TenderRequirement {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
}

interface TenderPlan {
  sections: Array<{
    title: string;
    description: string;
    requirements: string[];
    relevantDocuments: string[];
  }>;
  requirements: TenderRequirement[];
  evaluationCriteria: string[];
}

/**
 * TenderOrchestrator - Coordinates multiple specialized agents to generate tender documents
 * Uses a holistic approach with specialized agents for different tasks
 */
export class TenderOrchestrator extends BaseAgent {
  private retrieverAgent: RetrieverAgent;
  private drafterAgent: DrafterAgent;
  private complianceAgent: ComplianceAgent;
  private plannerAgent: PlannerAgent;
  private analyzerAgent: AnalyzerAgent;
  private tender: TenderDocument | null = null;
  private tenderPlan: TenderPlan | null = null;
  private isGenerating: boolean = false;
  private agentCalls: Record<string, number> = {};
  private sectionIterations: Record<string, number> = {};
  private sourceDocuments: SourceDocument[] = [];
  private companyDocuments: CompanyDocument[] = [];
  
  constructor() {
    super(
      "orchestrator",
      "You are a coordinator for tender preparation, managing the generation and assembly of tender response documents.",
      "gemini-2.0-flash-001",
    );
    this.retrieverAgent = new RetrieverAgent();
    this.drafterAgent = new DrafterAgent();
    this.complianceAgent = new ComplianceAgent();
    this.plannerAgent = new PlannerAgent();
    this.analyzerAgent = new AnalyzerAgent();
  }
  
  /**
   * Initialize the orchestrator with default values if needed
   */
  async init(): Promise<void> {
    // Ensure we have source documents by checking
    try {
      if (this.sourceDocuments.length === 0) {
        console.log("Initializing with empty source documents");
        this.sourceDocuments = [];
      }
      
      // Load company documents
      try {
        const response = await this.callRetrieverAgent({
          action: "getCompanyDocuments"
        });
        
        const data = JSON.parse(response.content);
        if (data.error) {
          console.warn("Warning retrieving company documents:", data.error);
          this.companyDocuments = [];
        } else {
          this.companyDocuments = data.documents || [];
        }
        
        console.log(`Retrieved ${this.companyDocuments.length} company documents`);
      } catch (error) {
        console.warn("Warning loading company documents:", error);
        this.companyDocuments = [];
      }
    } catch (error) {
      console.warn("Error during orchestrator initialization:", error);
      this.sourceDocuments = [];
      this.companyDocuments = [];
    }
  }
  
  /**
   * Start tender generation with the given options
   */
  async start(options: TenderGenerationOptions): Promise<GenerationResult> {
    const startTime = Date.now();
    this.agentCalls = {};
    this.sectionIterations = {};
    
    try {
      this.isGenerating = true;
      console.log(`Starting tender generation: "${options.title}"`);
      
      // Initialize orchestrator
      await this.init();
      
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
      
      // Step 1: Retrieve and analyze all source documents
      console.log("Step 1: Retrieving and analyzing source documents");
      options.onProgress?.("Retrieving and analyzing source documents");
      await this.retrieveAndAnalyzeSourceDocuments();
      
      // Step 2: Extract requirements from source documents
      console.log("Step 2: Extracting requirements from source documents");
      options.onProgress?.("Extracting requirements from source documents");
      const requirements = await this.extractRequirements();
      this.tender.compliance.requirements = requirements.map(r => r.description);
      
      // Step 3: Create a tender plan based on requirements
      console.log("Step 3: Creating tender plan");
      options.onProgress?.("Creating tender plan based on requirements");
      this.tenderPlan = await this.createTenderPlan(
        options.prompt,
        requirements,
        options.companyContext,
        options.additionalContext
      );
      
      // Step 4: Generate content for each section based on the plan
      console.log("Step 4: Generating content for each section");
      options.onProgress?.(`Planning to generate ${this.tenderPlan.sections.length} sections`);
      
      for (let i = 0; i < this.tenderPlan.sections.length; i++) {
        const sectionPlan = this.tenderPlan.sections[i];
        options.onProgress?.(
          `Generating section ${i + 1}/${this.tenderPlan.sections.length}: "${sectionPlan.title}"`
        );
        
        const section = await this.generateSectionFromPlan(
          sectionPlan,
          options.companyContext,
          options.additionalContext,
          options.maxIterations || 2
        );
        
        this.tender.sections.push(section);
        
        options.onProgress?.(
          `Completed section ${i + 1}/${this.tenderPlan.sections.length}`
        );
      }
      
      console.log(`Tender generation completed successfully: "${options.title}"`);
      options.onProgress?.("Tender generation completed successfully");
      
      const endTime = Date.now();
      return {
        success: true,
        tender: this.tender,
        stats: {
          totalTime: endTime - startTime,
          iterations: this.sectionIterations,
          agentCalls: this.agentCalls
        }
      };
    } catch (error) {
      console.error("Error generating tender:", error);
      
      options.onProgress?.(
        `Error generating tender: ${error instanceof Error ? error.message : String(error)}`
      );
      
      const endTime = Date.now();
      return {
        success: false,
        tender: this.tender || {
          id: uuidv4(),
          title: options.title,
          sections: [],
          compliance: { requirements: [], checklist: {} }
        },
        message: `Failed to generate tender: ${error instanceof Error ? error.message : String(error)}`,
        stats: {
          totalTime: endTime - startTime,
          iterations: this.sectionIterations,
          agentCalls: this.agentCalls
        }
      };
    } finally {
      this.isGenerating = false;
    }
  }
  
  /**
   * Retrieve and analyze all source documents
   */
  private async retrieveAndAnalyzeSourceDocuments(): Promise<void> {
    this.incrementAgentCalls("retriever");
    
    try {
      // Get all source documents from local storage instead of retriever agent
      try {
        const sources = await LocalDocumentStorage.getSourceDocuments();
        this.sourceDocuments = sources;
        
        // Also get company documents
        const companies = await LocalDocumentStorage.getCompanyDocuments();
        this.companyDocuments = companies;
        
        console.log(`Retrieved ${this.sourceDocuments.length} source documents and ${this.companyDocuments.length} company documents directly from local storage`);
      } catch (error) {
        console.error('Error loading documents from local storage:', error);
        this.sourceDocuments = [];
        this.companyDocuments = [];
      }
      
      // If no source documents found, throw error
      if (this.sourceDocuments.length === 0) {
        console.error("No source documents found");
        throw new Error("No source documents found. Please upload at least one tender document.");
      }
    } catch (error) {
      console.error("Error retrieving source documents:", error);
      throw error;
    }
  }
  
  /**
   * Extract requirements from source documents
   */
  private async extractRequirements(): Promise<TenderRequirement[]> {
    this.incrementAgentCalls("analyzer");
    
    // If there are no source documents, return some default requirements
    if (this.sourceDocuments.length === 0) {
      console.log("No source documents available for requirement extraction. Using defaults.");
      return this.getDefaultRequirements();
    }
    
    try {
      const response = await this.callAnalyzerAgent({
        action: "extractRequirements",
        documents: this.sourceDocuments
      });
      
      const data = JSON.parse(response.content);
      if (data.error) {
        console.warn("Warning extracting requirements:", data.error);
        return this.getDefaultRequirements();
      }
      
      const requirements = data.requirements || [];
      if (requirements.length === 0) {
        console.warn("No requirements extracted from documents. Using defaults.");
        return this.getDefaultRequirements();
      }
      
      return requirements;
    } catch (error) {
      console.warn("Warning extracting requirements:", error);
      return this.getDefaultRequirements();
    }
  }
  
  /**
   * Get default requirements when extraction fails
   */
  private getDefaultRequirements(): TenderRequirement[] {
    return [
      {
        id: "req-default-1",
        description: "Provide a comprehensive solution that meets industry standards",
        priority: "high",
        category: "general"
      },
      {
        id: "req-default-2",
        description: "Demonstrate relevant experience and qualifications",
        priority: "high",
        category: "qualification"
      },
      {
        id: "req-default-3",
        description: "Include a detailed project timeline and delivery schedule",
        priority: "medium",
        category: "timeline"
      },
      {
        id: "req-default-4",
        description: "Present a clear cost breakdown and budget allocation",
        priority: "medium",
        category: "financial"
      },
      {
        id: "req-default-5",
        description: "Outline the approach to quality assurance and risk management",
        priority: "medium",
        category: "methodology"
      }
    ];
  }
  
  /**
   * Create a tender plan based on requirements
   */
  private async createTenderPlan(
    prompt?: string,
    requirements: TenderRequirement[] = [],
    companyContext?: string,
    additionalContext?: string
  ): Promise<TenderPlan> {
    this.incrementAgentCalls("planner");
    
    // If we have no requirements, use default sections based on the prompt
    if (requirements.length === 0) {
      console.log("No requirements available, creating a default plan");
      
      // Create a more substantial default plan with common tender sections
      const defaultPlan: TenderPlan = {
        sections: [
          { 
            title: "Executive Summary", 
            description: "Overview of your proposal highlighting key strengths and benefits",
            requirements: [],
            relevantDocuments: []
          },
          { 
            title: "Company Profile", 
            description: "History, qualifications, and relevant experience of your organization",
            requirements: [],
            relevantDocuments: []
          },
          { 
            title: "Technical Proposal", 
            description: "Technical details of your proposed solution or approach",
            requirements: [],
            relevantDocuments: []
          },
          { 
            title: "Project Timeline", 
            description: "Proposed schedule, milestones, and delivery dates",
            requirements: [],
            relevantDocuments: []
          },
          { 
            title: "Cost Proposal", 
            description: "Detailed pricing, cost breakdown, and payment terms",
            requirements: [],
            relevantDocuments: []
          },
          { 
            title: "Quality Assurance Plan", 
            description: "Approach to quality control and risk management",
            requirements: [],
            relevantDocuments: []
          }
        ],
        requirements: requirements,
        evaluationCriteria: ["Technical merit", "Past performance", "Cost effectiveness", "Quality management", "Timeline feasibility"]
      };
      
      // If we have a prompt, use it to customize the default plan sections
      if (prompt) {
        defaultPlan.sections.push({ 
          title: "Custom Requirements", 
          description: "Addressing specific requirements from the prompt: " + prompt,
          requirements: [],
          relevantDocuments: []
        });
      }
      
      return defaultPlan;
    }
    
    try {
      // Create a limited company context summary to avoid token limit issues
      // Instead of passing the full text of all documents, create a summary
      let limitedCompanyContext = "";
      if (companyContext) {
        // Extract just the first 1000 characters or less
        limitedCompanyContext = "Company information summary: " + 
          (companyContext.length > 1000 ? 
            companyContext.substring(0, 1000) + "..." : 
            companyContext);
      }
      
      const response = await this.callPlannerAgent({
        action: "createPlan",
        prompt: prompt,
        requirements: requirements,
        companyContext: limitedCompanyContext, // Use the limited context
        additionalContext: additionalContext
      });
      
      try {
        const data = JSON.parse(response.content);
        if (data.error) {
          console.warn("Warning from planner agent:", data.error);
          return this.createDefaultPlan(requirements, prompt);
        }
        
        if (!data.plan || !data.plan.sections || data.plan.sections.length === 0) {
          console.warn("Planner returned invalid plan structure, using default");
          return this.createDefaultPlan(requirements, prompt);
        }
        
        return data.plan;
      } catch (parseError) {
        console.error("Error parsing planner response:", parseError);
        return this.createDefaultPlan(requirements, prompt);
      }
    } catch (error) {
      console.error("Error creating tender plan:", error);
      return this.createDefaultPlan(requirements, prompt);
    }
  }
  
  /**
   * Create a default plan when the planner fails
   */
  private createDefaultPlan(requirements: TenderRequirement[] = [], prompt?: string): TenderPlan {
    console.log("Creating default tender plan");
    
    // Group requirements by category
    const requirementsByCategory: Record<string, TenderRequirement[]> = {};
    
    requirements.forEach(req => {
      if (!requirementsByCategory[req.category]) {
        requirementsByCategory[req.category] = [];
      }
      requirementsByCategory[req.category].push(req);
    });
    
    // Create sections based on requirement categories
    const sections = Object.entries(requirementsByCategory).map(([category, reqs]) => {
      return {
        title: this.formatCategoryTitle(category),
        description: `This section addresses requirements related to ${category}`,
        requirements: reqs.map(r => r.description),
        relevantDocuments: []
      };
    });
    
    // Add standard sections if we have too few
    if (sections.length < 3) {
      sections.push({ 
        title: "Executive Summary", 
        description: "Overview of your proposal highlighting key strengths and benefits",
        requirements: [],
        relevantDocuments: []
      });
      
      sections.push({ 
        title: "Technical Approach", 
        description: "Details of the proposed technical solution",
        requirements: requirements.map(r => r.description),
        relevantDocuments: []
      });
      
      sections.push({ 
        title: "Experience and Qualifications", 
        description: "Company experience, qualifications, and past performance",
        requirements: [],
        relevantDocuments: []
      });
    }
    
    // If we have a prompt, add a custom section
    if (prompt) {
      sections.push({ 
        title: "Custom Requirements", 
        description: "Addressing specific requirements from the prompt: " + prompt,
        requirements: [],
        relevantDocuments: []
      });
    }
    
    return {
      sections,
      requirements,
      evaluationCriteria: ["Technical merit", "Past performance", "Cost effectiveness", "Quality management", "Timeline feasibility"]
    };
  }
  
  /**
   * Format a category string into a proper section title
   */
  private formatCategoryTitle(category: string): string {
    // Convert "some_category" or "someCategory" to "Some Category"
    return category
      .replace(/[_-]/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
      .trim();
  }
  
  /**
   * Extract company information from company documents
   */
  private getCompanyInformation(): { name: string, acronym: string, profile: string } {
    const defaultInfo = {
      name: "Your Company",
      acronym: "YC",
      profile: ""
    };
    
    try {
      // If we don't have any company documents, return defaults
      if (!this.companyDocuments || this.companyDocuments.length === 0) {
        console.log("No company documents available, using default company info");
        return defaultInfo;
      }
      
      console.log(`Processing ${this.companyDocuments.length} company documents for company info`);
      
      // Try to find a document with "profile" or "about" in the title
      const profileDoc = this.companyDocuments.find(doc => 
        doc.title.toLowerCase().includes("profile") || 
        doc.title.toLowerCase().includes("about") ||
        doc.title.toLowerCase().includes("company")
      );
      
      // Use the first document if no profile document is found
      const companyDoc = profileDoc || this.companyDocuments[0];
      
      // Extract company name - look for patterns like "Company Name:" or just the first line
      let name = defaultInfo.name;
      let acronym = defaultInfo.acronym;
      let profile = companyDoc.content || "";
      
      const nameMatch = profile.match(/company\s+name[\s:]+([^\n]+)/i) || 
                        profile.match(/name[\s:]+([^\n]+)/i) ||
                        profile.match(/^(.+?)(?:\n|$)/);
      
      if (nameMatch && nameMatch[1]) {
        name = nameMatch[1].trim();
        // Generate acronym from name (take first letter of each word)
        acronym = name.split(/\s+/).map(word => word[0]).join('').toUpperCase();
        if (acronym.length < 2) {
          // If acronym is too short, use first 2-3 letters of company name
          acronym = name.substring(0, Math.min(3, name.length)).toUpperCase();
        }
      }
      
      console.log(`Extracted company info - Name: ${name}, Acronym: ${acronym}`);
      
      return {
        name,
        acronym,
        profile
      };
    } catch (error) {
      console.error("Error extracting company information:", error);
      return defaultInfo;
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
    companyContext?: string,
    additionalContext?: string,
    maxIterations: number = 2
  ): Promise<TenderSection> {
    console.log(`Generating section: ${sectionPlan.title}`);
    this.incrementAgentCalls("drafter");
    
    // Create a unique ID for the section
    const sectionId = uuidv4();
    
    // Initialize the section iterations counter
    this.sectionIterations[sectionPlan.title] = 0;
    
    // Get company information to replace placeholders
    const companyInfo = this.getCompanyInformation();
    
    // Retrieve relevant documents for this section
    const relevantDocuments = await this.retrieveRelevantDocuments(
      sectionPlan.title,
      sectionPlan.relevantDocuments
    );
    
    // Create a basic section structure
    let section: TenderSection = {
      id: sectionId,
      title: sectionPlan.title,
      content: "",
      requirements: sectionPlan.requirements
    };
    
    // Generate initial content
    try {
      const response = await this.callDrafterAgent({
        action: "generateSection",
        section: {
          title: sectionPlan.title,
          description: sectionPlan.description,
          requirements: sectionPlan.requirements
        },
        company: {
          name: companyInfo.name,
          acronym: companyInfo.acronym,
          profile: companyInfo.profile
        },
        context: {
          company: companyContext || companyInfo.profile,
          additional: additionalContext || ""
        },
        relevantDocuments
      });
      
      // Increment the iteration counter
      this.sectionIterations[sectionPlan.title] = 1;
      
      try {
        const data = JSON.parse(response.content);
        if (data.error) {
          console.warn(`Warning generating section ${sectionPlan.title}:`, data.error);
          section.content = `Failed to generate content for section "${sectionPlan.title}": ${data.error}`;
        } else {
          section.content = data.content || "";
        }
      } catch (error) {
        console.warn(`Warning parsing section ${sectionPlan.title} response:`, error);
        section.content = response.content;
      }
    } catch (error) {
      console.error(`Error generating section "${sectionPlan.title}":`, error);
      section.content = `Failed to generate content for section "${sectionPlan.title}": ${error instanceof Error ? error.message : String(error)}`;
    }
    
    return section;
  }
  
  /**
   * Retrieve relevant documents for a section
   */
  private async retrieveRelevantDocuments(
    sectionTitle: string,
    relevantDocIds: string[] = []
  ): Promise<any[]> {
    this.incrementAgentCalls("retriever");
    
    try {
      // Get documents directly from local storage to preserve binary data
      const sources = await LocalDocumentStorage.getSourceDocuments();
      
      console.log(`Retrieved ${sources.length} documents from storage for section: ${sectionTitle}`);
      
      // If we have specific document IDs, filter by them
      if (relevantDocIds.length > 0) {
        const filteredDocs = sources.filter(doc => 
          relevantDocIds.includes(doc.id)
        );
        
        if (filteredDocs.length > 0) {
          return filteredDocs.map(doc => ({
            id: doc.id,
            content: doc.content || "Binary document",
            score: 1.0,
            metadata: doc.metadata || {},
            binaryData: doc.binaryData // Include binary data directly
          }));
        }
      }
      
      // Return all documents with binary data preserved
      // Limited to first 3 to avoid token limits
      return sources.slice(0, 3).map(doc => ({
        id: doc.id,
        content: doc.content || "Binary document",
        score: 1.0,
        metadata: doc.metadata || {},
        binaryData: doc.binaryData // Include binary data directly
      }));
    } catch (error) {
      console.error(`Error retrieving documents for section "${sectionTitle}":`, error);
      return [];
    }
  }
  
  /**
   * Call the planner agent
   */
  private async callPlannerAgent(data: any): Promise<AgentMessage> {
    this.incrementAgentCalls("planner");
    return await this.plannerAgent.processMessage({
      role: "orchestrator",
      content: JSON.stringify(data)
    });
  }
  
  /**
   * Call the analyzer agent
   */
  private async callAnalyzerAgent(data: any): Promise<AgentMessage> {
    this.incrementAgentCalls("analyzer");
    return await this.analyzerAgent.processMessage({
      role: "orchestrator",
      content: JSON.stringify(data)
    });
  }
  
  /**
   * Call the retriever agent
   */
  private async callRetrieverAgent(data: any): Promise<AgentMessage> {
    this.incrementAgentCalls("retriever");
    return await this.retrieverAgent.processMessage({
      role: "orchestrator",
      content: JSON.stringify(data)
    });
  }
  
  /**
   * Call the drafter agent
   */
  private async callDrafterAgent(data: any): Promise<AgentMessage> {
    this.incrementAgentCalls("drafter");
    return await this.drafterAgent.processMessage({
      role: "orchestrator",
      content: JSON.stringify(data)
    });
  }
  
  /**
   * Call the compliance agent
   */
  private async callComplianceAgent(data: any): Promise<AgentMessage> {
    this.incrementAgentCalls("compliance");
    return await this.complianceAgent.processMessage({
      role: "orchestrator",
      content: JSON.stringify(data)
    });
  }
  
  /**
   * Increment the count of agent calls
   */
  private incrementAgentCalls(agent: string): void {
    this.agentCalls[agent] = (this.agentCalls[agent] || 0) + 1;
  }
  
  /**
   * Process a message - required for BaseAgent interface but not used
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    // This method is not used as the orchestrator operates through the start method
    return {
      role: this.role,
      content: "The orchestrator does not process direct messages",
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }
} 