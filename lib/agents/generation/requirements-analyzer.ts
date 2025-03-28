import { TenderDocument, SourceDocument } from '../types'
import { aiService } from "@/lib/services/ai-service";
import { AgentRole } from "@/lib/config/ai-models";

// Add retry logic with exponential backoff
async function retryWithExponentialBackoff<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let retries = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      retries++;
      
      // If we've reached max retries or it's not a rate limit error, throw
      if (retries > maxRetries || error?.status !== 429) {
        throw error;
      }
      
      // Calculate delay with exponential backoff (1s, 2s, 4s, etc.)
      const delay = initialDelay * Math.pow(2, retries - 1);
      console.log(`Rate limit hit. Retrying in ${delay}ms (attempt ${retries}/${maxRetries})...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Reduce the size of large documents to prevent quota issues
function truncateDocumentContent(content: string, maxLength = 100000): string {
  if (content.length <= maxLength) return content;
  
  console.log(`Truncating document from ${content.length} to ${maxLength} characters`);
  return content.substring(0, maxLength) + `\n\n[Content truncated due to size limitations. Original size: ${content.length} characters]`;
}

export interface TenderRequirement {
  id: string
  title: string
  description: string
  priority: "high" | "medium" | "low"
  category: string
}

export class RequirementsAnalyzer {
  private sources: SourceDocument[] = []
  private companyDocs: SourceDocument[] = []
  private role: AgentRole = 'requirements';

  async addSource(document: SourceDocument) {
    this.sources.push(document)
  }

  async addCompanyDocument(document: SourceDocument) {
    this.companyDocs.push(document)
  }

  /**
   * Analyze requirements from multiple source documents
   */
  async analyzeSourceDocuments(): Promise<string> {
    let requirements = ""
    
    // Analyze each source document
    for (const source of this.sources) {
      const prompt = `
        Analyze this tender requirement document and extract key requirements, constraints, and evaluation criteria. 
        Focus on:
        1. Mandatory requirements
        2. Technical specifications
        3. Compliance criteria
        4. Evaluation metrics
        5. Budget constraints
        6. Timeline requirements
        7. Required certifications or qualifications
        8. Key deliverables

        Document content:
        ${truncateDocumentContent(source.content)}

        Format your response in clear, structured markdown.
      `;

      try {
        const analysis = await retryWithExponentialBackoff(() => 
          aiService.generateText(prompt, this.role)
        );
        requirements += `\n## Analysis of: ${source.title}\n${analysis}\n`
      } catch (error) {
        console.error(`Error analyzing source document ${source.title}:`, error)
        requirements += `\n## Analysis of: ${source.title}\nError analyzing this document. Please review it manually.\n`
      }
    }

    // Generate final synthesis and instructions
    const synthesisPrompt = `
      Based on the following analyses of tender requirement documents, create a comprehensive set of instructions for writing a tender response.
      Focus on key requirements, compliance points, and critical success factors.

      Previous analyses:
      ${requirements}

      Format your response as a clear set of instructions and focus points for the tender writer.
    `;

    try {
      return await retryWithExponentialBackoff(() => 
        aiService.generateText(synthesisPrompt, this.role)
      );
    } catch (error) {
      console.error("Error generating synthesis:", error)
      return "Error generating synthesis. Please review the source documents manually."
    }
  }

  /**
   * Analyze company documents for capabilities and strengths
   */
  async analyzeCompanyDocuments(): Promise<string> {
    if (this.companyDocs.length === 0) {
      return "No company documents available for analysis."
    }

    let companyCapabilities = ""
    
    // Analyze each company document
    for (const doc of this.companyDocs) {
      const prompt = `
        Analyze this company document and extract key capabilities, strengths, and qualifications.
        Focus on:
        1. Core competencies
        2. Technical capabilities
        3. Past experience and success stories
        4. Certifications and qualifications
        5. Unique selling points
        6. Team expertise
        7. Methodologies and approaches

        Document content:
        ${truncateDocumentContent(doc.content)}

        Format your response in clear, structured markdown.
      `;

      try {
        const analysis = await retryWithExponentialBackoff(() => 
          aiService.generateText(prompt, this.role)
        );
        companyCapabilities += `\n## Analysis of: ${doc.title}\n${analysis}\n`
      } catch (error) {
        console.error(`Error analyzing company document ${doc.title}:`, error)
        companyCapabilities += `\n## Analysis of: ${doc.title}\nError analyzing this document. Please review it manually.\n`
      }
    }

    // Generate final synthesis of company capabilities
    const synthesisPrompt = `
      Based on the following analyses of company documents, create a comprehensive summary of the company's capabilities and strengths.
      Focus on how these capabilities can be leveraged in tender responses.

      Previous analyses:
      ${companyCapabilities}

      Format your response as a clear set of capabilities and strengths that can be highlighted in tender responses.
    `;

    try {
      return await retryWithExponentialBackoff(() => 
        aiService.generateText(synthesisPrompt, this.role)
      );
    } catch (error) {
      console.error("Error generating company capabilities synthesis:", error)
      return "Error generating company capabilities synthesis. Please review the company documents manually."
    }
  }

  /**
   * Analyze a single requirements document
   */
  async analyzeRequirements(requirements: string): Promise<string> {
    const prompt = `
      Analyze the following tender requirements and extract key information:
      
      ${requirements}
      
      Please provide:
      1. Key requirements and constraints
      2. Evaluation criteria
      3. Technical specifications
      4. Compliance requirements
      5. Deadlines and important dates
      
      Format the response in a clear, structured manner.
    `;

    try {
      return await retryWithExponentialBackoff(() => 
        aiService.generateText(prompt, this.role)
      );
    } catch (error) {
      console.error('Error analyzing requirements:', error);
      throw error;
    }
  }

  /**
   * Generate a compliance checklist based on requirements
   */
  async generateComplianceChecklist(requirements: string): Promise<string> {
    const prompt = `
      Create a detailed compliance checklist based on these requirements:
      
      ${requirements}
      
      For each requirement:
      - List the specific compliance criteria
      - Note any mandatory documentation
      - Highlight critical deadlines
      - Flag any potential risks
      
      Format as a structured checklist.
    `;

    try {
      return await retryWithExponentialBackoff(() => 
        aiService.generateText(prompt, this.role, {
          temperature: 0.2, // Lower temperature for more precise output
        })
      );
    } catch (error) {
      console.error('Error generating compliance checklist:', error);
      throw error;
    }
  }

  /**
   * Generate clarifying questions for ambiguous requirements
   */
  async suggestClarifyingQuestions(requirements: string): Promise<string> {
    const prompt = `
      Review these tender requirements and suggest important clarifying questions:
      
      ${requirements}
      
      Focus on:
      - Ambiguous requirements
      - Missing information
      - Technical specifications needing clarification
      - Compliance requirements needing more detail
      
      Format as a numbered list of specific, well-formed questions.
    `;

    try {
      return await retryWithExponentialBackoff(() => 
        aiService.generateText(prompt, this.role, {
          temperature: 0.7, // Higher temperature for more creative questions
        })
      );
    } catch (error) {
      console.error('Error generating clarifying questions:', error);
      throw error;
    }
  }

  /**
   * Estimate the complexity of the tender requirements
   */
  async estimateComplexity(requirements: string): Promise<string> {
    const prompt = `
      Analyze these tender requirements and estimate the complexity:
      
      ${requirements}
      
      Consider:
      1. Technical complexity
      2. Resource requirements
      3. Timeline constraints
      4. Compliance complexity
      5. Integration challenges
      
      Provide a detailed analysis with complexity ratings (Low/Medium/High) for each aspect.
    `;

    try {
      return await retryWithExponentialBackoff(() => 
        aiService.generateText(prompt, this.role, {
          temperature: 0.3, // Lower temperature for more consistent analysis
        })
      );
    } catch (error) {
      console.error('Error estimating complexity:', error);
      throw error;
    }
  }

  // Utility methods
  getSources(): SourceDocument[] {
    return this.sources
  }

  getCompanyDocs(): SourceDocument[] {
    return this.companyDocs
  }

  clearSources() {
    this.sources = []
  }

  clearCompanyDocs() {
    this.companyDocs = []
  }
} 