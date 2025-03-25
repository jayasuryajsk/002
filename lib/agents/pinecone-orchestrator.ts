import { PineconeSearchAgent } from "./pinecone-search-agent";
import { RequirementsAnalyzer } from "./requirements-analyzer";
import { TenderDocument, TenderSection } from "./types";
import { v4 as uuidv4 } from 'uuid';
import { ensurePineconeIndex } from "../document-indexing/pinecone";

interface TenderGenerationOptions {
  title: string;
  sections: Array<{
    title: string;
    query?: string;
    requirements?: string[];
  }>;
  companyContext?: string;
  additionalContext?: string;
  useCompanyDocs?: boolean;
}

interface GenerationResult {
  success: boolean;
  tender: TenderDocument;
  message?: string;
}

/**
 * PineconeOrchestrator - A class for coordinating the generation of tender documents
 * using the Pinecone vector database for document retrieval.
 */
export class PineconeOrchestrator {
  private searchAgent: PineconeSearchAgent;
  private requirementsAnalyzer: RequirementsAnalyzer;
  private tender: TenderDocument | null = null;
  private isGenerating: boolean = false;

  constructor() {
    this.searchAgent = new PineconeSearchAgent();
    this.requirementsAnalyzer = new RequirementsAnalyzer();
    
    // Ensure Pinecone index exists
    ensurePineconeIndex().catch(err => {
      console.error('Failed to ensure Pinecone index exists:', err);
    });
  }

  /**
   * Generate a complete tender document based on the provided options
   */
  async generateTender(options: TenderGenerationOptions): Promise<GenerationResult> {
    try {
      this.isGenerating = true;
      console.log(`Starting tender generation: "${options.title}"`);

      // Initialize tender document
      this.tender = {
        id: uuidv4(),
        title: options.title,
        sections: [],
        compliance: {
          requirements: [],
          checklist: {}
        },
        // Store the useCompanyDocs setting
        useCompanyDocs: options.useCompanyDocs !== false // Default to true if not specified
      } as TenderDocument & { useCompanyDocs: boolean };

      // Log whether company docs are being used
      console.log(`Using company documents for context: ${this.tender.useCompanyDocs ? 'Yes' : 'No'}`);

      // Process each section in parallel for efficiency
      const sectionPromises = options.sections.map(section => 
        this.generateSection(section.title, section.query, section.requirements)
      );
      
      // Wait for all sections to complete
      const sections = await Promise.all(sectionPromises);
      
      // Update tender with generated sections
      this.tender.sections = sections;
      
      console.log(`Tender generation completed successfully: "${options.title}"`);
      
      return {
        success: true,
        tender: this.tender
      };
    } catch (error) {
      console.error("Error generating tender:", error);
      
      return {
        success: false,
        tender: this.tender || {
          id: uuidv4(),
          title: options.title,
          sections: [],
          compliance: { requirements: [], checklist: {} }
        },
        message: `Failed to generate tender: ${error instanceof Error ? error.message : String(error)}`
      };
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Generate a single section of the tender document
   */
  private async generateSection(title: string, query?: string, existingRequirements?: string[]): Promise<TenderSection> {
    console.log(`Generating section: "${title}"`);
    
    try {
      // Default search query if not provided
      const searchQuery = query || title;
      
      // Step 1: Search for relevant company documents if enabled
      const companySearchResults = this.tender && this.tender.useCompanyDocs !== false
        ? await this.searchAgent.search(searchQuery, {
            limit: 3,
            includeMetadata: true
          }, 'company')
        : [];
      
      console.log(`Found ${companySearchResults.length} relevant company documents for section "${title}"`);
      
      // Step 2: Search for relevant source documents
      const sourceSearchResults = await this.searchAgent.search(searchQuery, {
        limit: 5,
        includeMetadata: true
      }, 'source');
      
      console.log(`Found ${sourceSearchResults.length} relevant source documents for section "${title}"`);
      
      // Combine results, prioritizing company documents
      const searchResults = [
        ...companySearchResults,
        ...sourceSearchResults
      ].slice(0, 7); // Limit to 7 total documents to avoid token limits
      
      if (searchResults.length === 0) {
        return {
          id: uuidv4(),
          title,
          content: `# ${title}\n\nNo relevant information found for this section.`,
          requirements: existingRequirements || [],
          status: "draft"
        };
      }
      
      // Step 3: Extract requirements if not provided
      let requirements = existingRequirements || [];
      if (!requirements.length) {
        requirements = await this.searchAgent.extractRequirements(searchResults);
        console.log(`Extracted ${requirements.length} requirements for section "${title}"`);
      }
      
      // Step 4: Generate the section content
      const content = await this.searchAgent.generateTenderSection(title, searchResults, requirements);
      
      console.log(`Successfully generated content for section "${title}"`);
      
      return {
        id: uuidv4(),
        title,
        content,
        requirements,
        status: "draft"
      };
    } catch (error) {
      console.error(`Error generating section "${title}":`, error);
      
      return {
        id: uuidv4(),
        title,
        content: `# ${title}\n\nFailed to generate this section due to an error: ${error instanceof Error ? error.message : String(error)}`,
        requirements: existingRequirements || [],
        status: "draft"
      };
    }
  }
  
  /**
   * Check if the orchestrator is currently generating a tender
   */
  isGeneratingTender(): boolean {
    return this.isGenerating;
  }
  
  /**
   * Get the current tender document
   */
  getCurrentTender(): TenderDocument | null {
    return this.tender;
  }
  
  /**
   * Add compliance requirements to the tender
   */
  async addComplianceRequirements(requirements: string[]): Promise<void> {
    if (!this.tender) {
      throw new Error("No tender document initialized");
    }
    
    this.tender.compliance.requirements = [
      ...this.tender.compliance.requirements,
      ...requirements
    ];
    
    // Initialize checklist items to false
    requirements.forEach(req => {
      if (!this.tender!.compliance.checklist[req]) {
        this.tender!.compliance.checklist[req] = false;
      }
    });
  }
  
  /**
   * Check if a section meets compliance requirements
   */
  async checkSectionCompliance(sectionIndex: number): Promise<{ 
    passed: boolean; 
    issues: string[];
  }> {
    if (!this.tender) {
      throw new Error("No tender document initialized");
    }
    
    if (sectionIndex < 0 || sectionIndex >= this.tender.sections.length) {
      throw new Error(`Invalid section index: ${sectionIndex}`);
    }
    
    const section = this.tender.sections[sectionIndex];
    const requirements = this.tender.compliance.requirements;
    
    // No requirements to check
    if (requirements.length === 0) {
      return { passed: true, issues: [] };
    }
    
    // Use the search agent to analyze compliance
    try {
      // Create a mock search result with the section content
      const sectionContent = [{
        id: `section-${sectionIndex}`,
        content: section.content,
        score: 1.0
      }];
      
      // Generate a summary analysis focusing on compliance
      const model = (await import("@google/generative-ai")).GoogleGenerativeAI;
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
      if (!apiKey) {
        console.warn("GOOGLE_GENERATIVE_AI_API_KEY is not set");
      }
      const genAI = new model(apiKey);
      const aiModel = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-001"
      });
      
      const prompt = `
        Evaluate if the following tender section meets these compliance requirements:
        
        REQUIREMENTS:
        ${requirements.map((req, i) => `${i+1}. ${req}`).join('\n')}
        
        SECTION CONTENT:
        ${section.content}
        
        For each requirement, determine if the section properly addresses it.
        Format your response as a JSON object with:
        1. An overall "passed" boolean indicating if all requirements are met
        2. An "issues" array listing any requirements that aren't properly addressed
        3. For each issue, explain why it fails to meet the requirement
        
        Example format:
        {
          "passed": false,
          "issues": [
            "Requirement #2: The section does not mention the required ISO certification"
          ]
        }
      `;
      
      const result = await aiModel.generateContent(prompt);
      const response = result.response.text();
      
      try {
        // Extract the JSON from the response
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                         response.match(/```\n([\s\S]*?)\n```/) || 
                         response.match(/(\{[\s\S]*\})/);
        
        const jsonStr = jsonMatch ? jsonMatch[1] : response;
        const compliance = JSON.parse(jsonStr);
        
        // Update the section status based on compliance
        section.status = compliance.passed ? "approved" : "review";
        
        return {
          passed: compliance.passed,
          issues: compliance.issues || []
        };
      } catch (parseError) {
        console.error('Error parsing compliance check:', parseError);
        return { passed: false, issues: ["Failed to parse compliance check results"] };
      }
    } catch (error) {
      console.error(`Error checking compliance for section "${section.title}":`, error);
      return { 
        passed: false, 
        issues: [`Error checking compliance: ${error instanceof Error ? error.message : String(error)}`] 
      };
    }
  }
} 