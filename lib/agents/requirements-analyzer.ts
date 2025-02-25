import { GoogleGenerativeAI } from "@google/generative-ai"
import { TenderDocument, SourceDocument } from './types'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "")

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

export class RequirementsAnalyzer {
  private sources: SourceDocument[] = []
  private companyDocs: SourceDocument[] = []

  async addSource(document: SourceDocument) {
    this.sources.push(document)
  }

  async addCompanyDocument(document: SourceDocument) {
    this.companyDocs.push(document)
  }

  async analyzeRequirements(): Promise<string> {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" })

    let requirements = ""
    
    // Analyze each source document
    for (const source of this.sources) {
      const prompt = `Analyze this tender requirement document and extract key requirements, constraints, and evaluation criteria. 
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

      Format your response in clear, structured markdown.`

      try {
        const result = await retryWithExponentialBackoff(() => 
          model.generateContent(prompt)
        );
        const analysis = result.response.text()
        requirements += `\n## Analysis of: ${source.title}\n${analysis}\n`
      } catch (error) {
        console.error(`Error analyzing source document ${source.title}:`, error)
        requirements += `\n## Analysis of: ${source.title}\nError analyzing this document. Please review it manually.\n`
      }
    }

    // Generate final synthesis and instructions
    const synthesisPrompt = `Based on the following analyses of tender requirement documents, create a comprehensive set of instructions for writing a tender response.
    Focus on key requirements, compliance points, and critical success factors.

    Previous analyses:
    ${requirements}

    Format your response as a clear set of instructions and focus points for the tender writer.`

    try {
      const synthesis = await retryWithExponentialBackoff(() => 
        model.generateContent(synthesisPrompt)
      );
      return synthesis.response.text()
    } catch (error) {
      console.error("Error generating synthesis:", error)
      return "Error generating synthesis. Please review the source documents manually."
    }
  }

  async analyzeCompanyDocuments(): Promise<string> {
    if (this.companyDocs.length === 0) {
      return "No company documents available for analysis."
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" })
    
    let companyCapabilities = ""
    
    // Analyze each company document
    for (const doc of this.companyDocs) {
      const prompt = `Analyze this company document and extract key capabilities, strengths, and qualifications.
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

      Format your response in clear, structured markdown.`

      try {
        const result = await retryWithExponentialBackoff(() => 
          model.generateContent(prompt)
        );
        const analysis = result.response.text()
        companyCapabilities += `\n## Analysis of: ${doc.title}\n${analysis}\n`
      } catch (error) {
        console.error(`Error analyzing company document ${doc.title}:`, error)
        companyCapabilities += `\n## Analysis of: ${doc.title}\nError analyzing this document. Please review it manually.\n`
      }
    }

    // Generate final synthesis of company capabilities
    const synthesisPrompt = `Based on the following analyses of company documents, create a comprehensive summary of the company's capabilities and strengths.
    Focus on how these capabilities can be leveraged in tender responses.

    Previous analyses:
    ${companyCapabilities}

    Format your response as a clear set of capabilities and strengths that can be highlighted in tender responses.`

    try {
      const synthesis = await retryWithExponentialBackoff(() => 
        model.generateContent(synthesisPrompt)
      );
      return synthesis.response.text()
    } catch (error) {
      console.error("Error generating company capabilities synthesis:", error)
      return "Error generating company capabilities synthesis. Please review the company documents manually."
    }
  }

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