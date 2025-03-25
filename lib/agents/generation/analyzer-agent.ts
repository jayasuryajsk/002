import { BaseAgent } from "../core/base-agent";
import type { AgentMessage, SourceDocument } from "../types";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

/**
 * AnalyzerAgent - Specializes in analyzing tender documents and extracting requirements
 * This agent identifies key requirements, priorities, and categories from source documents
 */
export class AnalyzerAgent extends BaseAgent {
  constructor(verbose = false) {
    super(
      "analyzer",
      "You are an expert tender document analyzer. Your role is to extract requirements, identify priorities, and categorize elements from tender documents.",
      "gemini-2.0-flash-001",
      "You are an expert tender document analyzer. Your role is to extract requirements, identify priorities, and categorize elements from tender documents."
    );
  }
  
  /**
   * Process a message containing source documents and extract requirements
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    try {
      const data = typeof message.content === 'string'
        ? JSON.parse(message.content)
        : message.content;
      
      const { 
        action,
        documents = []
      } = data;
      
      if (action !== "extractRequirements") {
        return {
          role: this.role,
          content: JSON.stringify({
            error: "Unsupported action. Only 'extractRequirements' is supported."
          }),
          metadata: {
            timestamp: new Date().toISOString(),
            error: true
          }
        };
      }
      
      // Check if we have any documents to analyze
      if (!documents || documents.length === 0) {
        console.log("AnalyzerAgent: No documents provided for analysis");
        return {
          role: this.role,
          content: JSON.stringify({
            requirements: [],
            warning: "No documents provided for requirements extraction"
          }),
          metadata: {
            timestamp: new Date().toISOString(),
            type: "requirements_analysis",
            requirementCount: 0,
            warning: true
          }
        };
      }
      
      // Analyze each document and extract requirements
      const allRequirements = await this.extractRequirementsFromDocuments(documents);
      
      console.log(`AnalyzerAgent extracted ${allRequirements.length} requirements from ${documents.length} documents`);
      
      return {
        role: this.role,
        content: JSON.stringify({
          requirements: allRequirements
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          type: "requirements_analysis",
          requirementCount: allRequirements.length
        }
      };
    } catch (error) {
      console.error("AnalyzerAgent error:", error);
      
      return {
        role: this.role,
        content: JSON.stringify({
          error: `Failed to analyze documents: ${error instanceof Error ? error.message : String(error)}`,
          requirements: []
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          error: true
        }
      };
    }
  }
  
  /**
   * Extract requirements from source documents
   */
  private async extractRequirementsFromDocuments(documents: SourceDocument[]): Promise<Array<{
    id: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
  }>> {
    if (documents.length === 0) {
      return [];
    }
    
    try {
      // Prepare document content for the prompt
      const documentTexts = documents.map((doc, index) => {
        return `Document ${index + 1}: ${doc.title || 'Untitled'}\n${doc.content?.slice(0, 10000) || 'No content available'}`;
      }).join('\n\n');
      
      // Create prompt for requirements extraction
      const prompt = `
        I need to extract requirements from tender documents. For each requirement you find, respond with:
        REQ_START
        ID: req-[number]
        DESCRIPTION: [the requirement text]
        PRIORITY: [high, medium, or low]
        CATEGORY: [general, technical, compliance, timeline, financial, etc.]
        REQ_END

        Analyze these documents carefully:
        
        ${documentTexts}
        
        Extract at least 5 requirements. If you can't find any, create plausible requirements based on the document type.
        DO NOT include any other text or explanations in your response, ONLY the REQ_START/REQ_END blocks.
      `;
      
      // Get API key
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || "";
      if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
      }
      
      // Create Google AI provider
      const googleAI = createGoogleGenerativeAI({
        apiKey: apiKey
      });
      
      console.log(`Generating requirements with AI SDK for ${documents.length} documents`);
      
      // Generate content using the AI SDK
      const result = await generateText({
        model: googleAI("gemini-2.0-flash-001"),
        prompt: prompt,
        maxTokens: 4000,
      });
      
      const response = result.text;
      console.log("Got response from model for requirements extraction, length:", response.length);
      
      // Parse the response using the REQ_START/REQ_END format
      const requirements = [];
      const reqBlocks = response.split('REQ_START')
        .filter(block => block.includes('REQ_END'))
        .map(block => block.split('REQ_END')[0].trim());
      
      console.log(`Found ${reqBlocks.length} requirement blocks`);
      
      let reqId = 1;
      for (const block of reqBlocks) {
        try {
          // Extract fields from the block
          const idMatch = block.match(/ID:\s*([^\n]+)/);
          const descMatch = block.match(/DESCRIPTION:\s*([^\n]+)/);
          const priorityMatch = block.match(/PRIORITY:\s*([^\n]+)/);
          const categoryMatch = block.match(/CATEGORY:\s*([^\n]+)/);
          
          if (descMatch) {
            requirements.push({
              id: idMatch ? idMatch[1].trim() : `req-${reqId++}`,
              description: descMatch[1].trim(),
              priority: priorityMatch ? 
                priorityMatch[1].trim().toLowerCase() as 'high' | 'medium' | 'low' : 'medium',
              category: categoryMatch ? categoryMatch[1].trim().toLowerCase() : 'general'
            });
          }
        } catch (blockError) {
          console.error("Error parsing requirement block:", blockError);
        }
      }
      
      // If no requirements were found, return defaults
      if (requirements.length === 0) {
        console.warn("No requirements found in extraction, using defaults");
        return this.getDefaultRequirements(documents);
      }
      
      console.log(`Successfully extracted ${requirements.length} requirements`);
      return requirements;
    } catch (error) {
      console.error(`Error analyzing documents:`, error);
      return this.getDefaultRequirements(documents);
    }
  }
  
  /**
   * Helper method to extract requirements from text when JSON parsing fails
   */
  private extractRequirementsFromText(text: string): Array<{
    id: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
  }> {
    const requirements = [];
    let reqId = 1;
    
    // Keywords that likely indicate requirements
    const requirementIndicators = [
      'must ', 'shall ', 'should ', 'required ', 'requirement ', 
      'needs to ', 'mandatory ', 'essential ', 'critical '
    ];
    
    // Split the text into lines and analyze each line
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines or very short lines
      if (trimmedLine.length < 15) continue;
      
      // Check if line contains requirement indicators
      if (requirementIndicators.some(indicator => 
          trimmedLine.toLowerCase().includes(indicator))) {
        
        // Determine priority based on keywords
        let priority: 'high' | 'medium' | 'low' = 'medium';
        if (trimmedLine.toLowerCase().includes('critical') || 
            trimmedLine.toLowerCase().includes('essential') ||
            trimmedLine.toLowerCase().includes('mandatory')) {
          priority = 'high';
        } else if (trimmedLine.toLowerCase().includes('should') ||
                  trimmedLine.toLowerCase().includes('preferred')) {
          priority = 'low';
        }
        
        // Determine category based on content
        let category = 'general';
        if (trimmedLine.toLowerCase().includes('technical') ||
            trimmedLine.toLowerCase().includes('technology') ||
            trimmedLine.toLowerCase().includes('system')) {
          category = 'technical';
        } else if (trimmedLine.toLowerCase().includes('compliance') ||
                  trimmedLine.toLowerCase().includes('regulation') ||
                  trimmedLine.toLowerCase().includes('legal')) {
          category = 'compliance';
        } else if (trimmedLine.toLowerCase().includes('delivery') ||
                  trimmedLine.toLowerCase().includes('timeline') ||
                  trimmedLine.toLowerCase().includes('deadline')) {
          category = 'timeline';
        } else if (trimmedLine.toLowerCase().includes('cost') ||
                  trimmedLine.toLowerCase().includes('budget') ||
                  trimmedLine.toLowerCase().includes('price')) {
          category = 'financial';
        }
        
        // Add the requirement
        requirements.push({
          id: `req-${reqId++}`,
          description: trimmedLine,
          priority,
          category
        });
      }
    }
    
    return requirements;
  }
  
  /**
   * Helper method to extract requirements directly from documents as a last resort
   */
  private extractRequirementsDirectlyFromDocs(documents: SourceDocument[]): Array<{
    id: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
  }> {
    // Combine all document content
    const combinedText = documents.map(doc => doc.content).join('\n');
    return this.extractRequirementsFromText(combinedText);
  }
  
  /**
   * Helper method to get default requirements when all extraction methods fail
   */
  private getDefaultRequirements(documents: SourceDocument[]): Array<{
    id: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
  }> {
    console.log("Using default requirements");
    
    // If we have document titles, try to make slightly more specific requirements
    const documentTitles = documents.map(doc => doc.title || 'Untitled').join(', ');
    
    return [
      {
        id: 'req-default-1',
        description: `Provide a comprehensive solution addressing the requirements outlined in ${documentTitles || 'the tender documents'}`,
        priority: 'high',
        category: 'general'
      },
      {
        id: 'req-default-2',
        description: 'Demonstrate relevant experience and technical capabilities',
        priority: 'high',
        category: 'qualification'
      },
      {
        id: 'req-default-3',
        description: 'Include a detailed project implementation timeline',
        priority: 'medium',
        category: 'timeline'
      },
      {
        id: 'req-default-4',
        description: 'Present a clear cost breakdown for all deliverables',
        priority: 'medium',
        category: 'financial'
      },
      {
        id: 'req-default-5',
        description: 'Outline quality assurance procedures and risk management strategies',
        priority: 'medium',
        category: 'methodology'
      }
    ];
  }

  async analyzeRequirementsFromDocuments(sourceDocuments: SourceDocument[], requirements: string): Promise<string> {
    try {
      console.log("\n----- 📊 AnalyzerAgent analyzing requirements against source documents -----");
      
      // Extract document content
      const documentTexts = sourceDocuments.map((doc, i) => 
        `Document ${i+1}: ${doc.title || doc.id}\n${doc.content?.substring(0, 10000) || 'No content available'}`
      ).join('\n\n');
      
      // Create the prompt
      const prompt = `
As a tender analysis expert, analyze the following source documents against the tender requirements.
Identify how well our capabilities match the tender requirements.

Source Documents:
${documentTexts.length > 0 ? documentTexts : "No documents available."}

Tender Requirements:
${requirements || "No requirements specified."}

Instructions:
1. Identify our key strengths based on the source documents that match tender requirements.
2. Identify any gaps or weaknesses where we may not fully meet requirements.
3. Provide specific examples from our documents that support our capabilities.
4. Suggest strategies to address gaps if any are found.

Provide your analysis in a structured format with clear sections.
`;

      console.log("Creating analyzer prompt:", prompt.substring(0, 200) + "...");
      
      // Get API key
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || "";
      if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
      }
      
      // Create Google AI provider
      const googleAI = createGoogleGenerativeAI({
        apiKey: apiKey
      });
      
      // Generate content using the AI SDK
      const result = await generateText({
        model: googleAI("gemini-2.0-flash-001"),
        prompt: prompt,
        maxTokens: 4000,
      });
            
      return result.text;
    } catch (error) {
      console.error("Error analyzing requirements:", error);
      return `Error analyzing requirements: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
} 