import { BaseAgent } from "../core/base-agent";
import type { AgentMessage } from "../types";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

/**
 * DrafterAgent - Specializes in generating high-quality tender content
 * This agent creates persuasive, compliance-focused content based on retrieved documents
 */
export class DrafterAgent extends BaseAgent {
  constructor() {
    super(
      "drafter",
      "You are an expert tender content writer. Your role is to create persuasive, professional tender submissions that address all requirements and highlight capabilities effectively.",
      "gemini-2.0-flash",
      "You are an expert tender content writer. Your role is to create persuasive, professional tender submissions that address all requirements and highlight capabilities effectively."
    );
  }
  
  /**
   * Process a message containing retrieval results and generate tender content
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    try {
      const data = typeof message.content === 'string'
        ? JSON.parse(message.content)
        : message.content;
      
      // Handle the new format with the action parameter
      if (data.action === "generateSection") {
        return await this.generateSection(data);
      }
      
      // Legacy format handling for backward compatibility
      const { 
        sectionTitle, 
        sectionDescription = "",
        searchResults = [], 
        requirements = [],
        companyContext = "",
        additionalContext = "",
        previousContent = "",
        previousFeedback = null
      } = data;
      
      // Detect if we have useful content to work with
      const hasUsefulContent = searchResults.length > 0 || requirements.length > 0 || 
                              companyContext.length > 0 || previousContent.length > 0;
      
      // Handle case with minimal input
      if (!hasUsefulContent) {
        console.log(`DrafterAgent: Minimal input for section "${sectionTitle}", using creative generation`);
        
        // Generate content based just on section title and description
        const creativePrompt = `
          Write a professional and persuasive tender section titled "${sectionTitle}".
          
          ${sectionDescription ? `Section Description: ${sectionDescription}\n\n` : ''}
          
          Since I don't have specific details, create plausible content for this section that would:
          1. Demonstrate understanding of standard tender requirements in this area
          2. Highlight generic company strengths and capabilities
          3. Include professional language and formatting appropriate for formal tenders
          4. Suggest specific approaches, methodologies, or solutions
          5. Format the output in markdown with proper headings, lists, and structure
          
          The section should be detailed enough to be convincing (at least 300-500 words) but not include made-up specific facts or claims.
        `;
        
        const generatedContent = await this.generateResponse(creativePrompt);
        
        console.log(`DrafterAgent generated creative content for section: "${sectionTitle}"`);
        
        return {
          role: this.role,
          content: JSON.stringify({
            sectionTitle,
            content: generatedContent,
            requirements: requirements,
            generationMethod: "creative" // Indicate this was creative generation
          }),
          metadata: {
            timestamp: new Date().toISOString(),
            type: "draft_content",
            sectionTitle,
            contentLength: generatedContent.length,
            inputsAvailable: {
              searchResults: searchResults.length > 0,
              requirements: requirements.length > 0,
              companyContext: Boolean(companyContext),
              additionalContext: Boolean(additionalContext),
              previousContent: Boolean(previousContent),
              previousFeedback: Boolean(previousFeedback)
            }
          }
        };
      }
      
      // Process the documents for drafting
      const documentTexts = searchResults.map((doc: any, index: number) => {
        return `Document ${index + 1} (Relevance: ${doc.score?.toFixed(2) || "HIGH"}):\n${doc.content.slice(0, 1500)}${doc.content.length > 1500 ? '...' : ''}`;
      }).join('\n\n');
      
      // Format requirements
      const requirementsText = requirements.length > 0
        ? `\nRequirements:\n${requirements.map((req: string, i: number) => `${i+1}. ${req}`).join('\n')}`
        : '';
      
      // Format previous feedback if available
      const feedbackText = previousFeedback
        ? `\nPrevious Feedback:\n${previousFeedback.issues.map((issue: string) => `- ${issue}`).join('\n')}\n\nSuggestions:\n${previousFeedback.suggestions.map((suggestion: string) => `- ${suggestion}`).join('\n')}`
        : '';
        
      // Create prompt for content generation
      const prompt = `
        Write a comprehensive tender section titled "${sectionTitle}" based on the following information.
        
        ${sectionDescription ? `Section Description: ${sectionDescription}\n\n` : ''}
        
        ${documentTexts}
        
        ${requirementsText}
        
        ${companyContext ? `\nCompany Context:\n${companyContext}` : ''}
        
        ${additionalContext ? `\nAdditional Context:\n${additionalContext}` : ''}
        
        ${previousContent ? `\nPrevious Draft:\n${previousContent}` : ''}
        
        ${feedbackText}
        
        Guidelines:
        1. The section should be well-structured, professional, and persuasive
        2. Address all the requirements relevant to this section
        3. Use specific details from the documents as evidence
        4. Highlight capabilities, experiences, and qualifications
        5. Use strong, clear language appropriate for a formal tender
        6. Format the output in markdown with appropriate headings, lists, and emphasis
        7. Ensure the content is substantive and detailed (minimum 400 words)
        ${previousContent ? '8. Improve upon the previous draft, addressing all feedback' : ''}
        
        Write the section in a way that would impress evaluators and demonstrate a clear understanding of the requirements.
      `;
      
      // Generate the content
      const generatedContent = await this.generateResponse(prompt);
      
      console.log(`DrafterAgent generated content for section: "${sectionTitle}" (length: ${generatedContent.length} chars)`);
      
      // Return the result
      return {
        role: this.role,
        content: JSON.stringify({
          sectionTitle,
          content: generatedContent,
          requirements,
          generationMethod: "standard"
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          type: "draft_content",
          sectionTitle,
          contentLength: generatedContent.length,
          inputsAvailable: {
            searchResults: searchResults.length > 0,
            requirements: requirements.length > 0,
            companyContext: Boolean(companyContext),
            additionalContext: Boolean(additionalContext),
            previousContent: Boolean(previousContent),
            previousFeedback: Boolean(previousFeedback)
          }
        }
      };
    } catch (error) {
      console.error("DrafterAgent error:", error);
      
      // Parse the message content to extract sectionTitle if possible
      let sectionTitle = 'Section';
      let sectionDescription = '';
      try {
        const parsedContent = typeof message.content === 'string' 
          ? JSON.parse(message.content) 
          : message.content;
        sectionTitle = parsedContent.sectionTitle || 'Section';
        sectionDescription = parsedContent.sectionDescription || '';
      } catch (parseError) {
        // If parsing fails, use default
      }
      
      // Generate fallback content for robustness
      let fallbackContent;
      try {
        const fallbackPrompt = `
          Write a professional tender section titled "${sectionTitle}".
          ${sectionDescription ? `\nDescription: ${sectionDescription}` : ''}
          
          Create a generic but professional section that would be appropriate for a tender document.
          Format in markdown and make it approximately 300 words in length.
        `;
        fallbackContent = await this.generateResponse(fallbackPrompt);
      } catch (fallbackError) {
        fallbackContent = `# ${sectionTitle}\n\nUnable to generate content due to an error. Please try again.`;
      }
      
      return {
        role: this.role,
        content: JSON.stringify({
          error: `Failed to generate content: ${error instanceof Error ? error.message : String(error)}`,
          sectionTitle,
          content: fallbackContent,
          generationMethod: "fallback"
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          error: true,
          recovery: "fallback_content_generated"
        }
      };
    }
  }

  /**
   * Generate content for a section with company information
   */
  private async generateSection(data: any): Promise<AgentMessage> {
    try {
      const { 
        section, 
        company, 
        context, 
        relevantDocuments = [] 
      } = data;
      
      if (!section || !section.title) {
        throw new Error("Section information is required");
      }
      
      console.log(`DrafterAgent: Generating content for section "${section.title}" with company information`);
      
      // Extract company information
      const companyName = company?.name || "Your Company";
      const companyAcronym = company?.acronym || "YC";
      const companyProfile = company?.profile || "";
      
      // Create the content for the prompt
      let documentTexts = '';
      
      // Process the documents for drafting
      for (const doc of relevantDocuments) {
        if (doc.content) {
          documentTexts += `Document: ${doc.metadata?.title || doc.id || 'Untitled'}\n\n${doc.content.slice(0, 1500)}${doc.content.length > 1500 ? '...' : ''}\n\n`;
          console.log(`Added text document: ${doc.metadata?.title || doc.id}`);
        }
      }
      
      // Create prompt for content generation
      const prompt = `
        Write a comprehensive tender section titled "${section.title}" with the following description:
        "${section.description || "No description provided"}"
        
        Requirements to address:
        ${section.requirements && section.requirements.length > 0 ? 
          section.requirements.map((req: string, i: number) => `${i+1}. ${req}`).join('\n') : 
          "No specific requirements provided"}
        
        Company information:
        - Company Name: ${companyName}
        - Company Acronym: ${companyAcronym}
        ${companyProfile ? `\nCompany Profile:\n${companyProfile}` : ''}
        
        ${documentTexts ? `\nRelevant Documents:\n${documentTexts}` : ''}
        
        ${context?.additional ? `\nAdditional Context:\n${context.additional}` : ''}
        
        Guidelines:
        1. The section should be well-structured, professional, and persuasive
        2. Address all the requirements relevant to this section
        3. Use specific details from the provided documents as evidence
        4. Highlight the company's capabilities, experiences, and qualifications
        5. Use strong, clear language appropriate for a formal tender
        6. Format the output in markdown with appropriate headings, lists, and emphasis
        
        Write the section in a way that would impress evaluators and demonstrate a clear understanding of the requirements.
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
      
      console.log(`Making API call with AI SDK for section: ${section.title}`);
      
      // Generate content using the AI SDK
      const result = await generateText({
        model: googleAI("gemini-2.0-flash-001"),
        prompt: prompt,
        maxTokens: 4000,
      });
      
      const generatedContent = result.text;
      
      // Return the generated content
      return {
        role: this.role,
        content: JSON.stringify({
          content: generatedContent,
          requirements: section.requirements || []
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          type: "section_content",
          sectionTitle: section.title,
          contentLength: generatedContent.length
        }
      };
    } catch (error) {
      console.error(`Error generating section:`, error);
      
      // Return error
      return {
        role: this.role,
        content: JSON.stringify({
          error: `Failed to generate section content: ${error instanceof Error ? error.message : String(error)}`,
          content: `# ${data?.section?.title || 'Section'}\n\nUnable to generate content due to an error: ${error instanceof Error ? error.message : 'Unknown error'}.`
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          error: true
        }
      };
    }
  }

  async draftSectionContent(
    sectionTitle: string,
    tenderId: string,
    companyInfo: string,
    requirements: string,
    relevantSourceText: string
  ): Promise<string> {
    try {
      console.log(`\n----- ✍️ DrafterAgent drafting section: ${sectionTitle} -----`);
      
      // Create the prompt
      const prompt = `
You are drafting the "${sectionTitle}" section of a professional tender response. 
Use the following information to create high-quality, persuasive content.

Tender ID: ${tenderId}

Company Information:
${companyInfo}

Requirements for this section:
${requirements}

Relevant information from our previous documents:
${relevantSourceText}

Instructions:
1. Write professionally using clear, confident business language
2. Include specific details from our company information and previous documents 
3. Address all the requirements explicitly
4. Be persuasive and highlight our strengths
5. Maintain a formal, professional tone
6. Use appropriate headings and structure
7. Keep content directly relevant to this section
8. The content should be between 400-800 words

Now, draft the "${sectionTitle}" section:
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
      
      // Generate content using the AI SDK
      const result = await generateText({
        model: googleAI("gemini-2.0-flash-001"),
        prompt: prompt,
        maxTokens: 4000,
      });
            
      return result.text;
    } catch (error) {
      console.error(`Error drafting section ${sectionTitle}:`, error);
      return `Error drafting section: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
} 