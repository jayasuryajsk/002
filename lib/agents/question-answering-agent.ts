import { BaseAgent } from "./base-agent";
import { AgentMessage } from "./types";
import { PineconeSearchAgent } from "./pinecone-search-agent";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * QuestionAnsweringAgent - Specializes in answering questions by searching information in Pinecone
 * This agent leverages Pinecone search and LLM to generate concise, accurate answers
 * based on the stored data (both company and source documents).
 */
export class QuestionAnsweringAgent extends BaseAgent {
  private searchAgent: PineconeSearchAgent;
  private genAI: GoogleGenerativeAI;
  
  constructor() {
    super(
      "qa", 
      "You are an expert question answering agent. Your role is to answer questions accurately based on company and tender documents."
    );
    this.searchAgent = new PineconeSearchAgent();
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');
  }
  
  /**
   * Process a question message and return an answer based on document search
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    try {
      // Parse the request
      const data = typeof message.content === 'string'
        ? JSON.parse(message.content)
        : message.content;
      
      // Extract question and search parameters
      const { 
        question, 
        limit = 5, 
        documentType = 'all',  // 'company', 'source', or 'all'
        includeContext = false // Whether to include the context used to answer
      } = data;
      
      if (!question) {
        return {
          role: this.role,
          content: JSON.stringify({
            success: false,
            error: "Question is required",
            answer: null,
            context: null
          })
        };
      }
      
      // Search for relevant context in Pinecone
      const searchResults = await this.searchAgent.search(question, {
        limit,
        includeMetadata: true
      }, documentType);
      
      if (searchResults.length === 0) {
        return {
          role: this.role,
          content: JSON.stringify({
            success: false,
            error: "No relevant information found",
            answer: "I don't have any information about that in my knowledge base.",
            context: []
          })
        };
      }
      
      // Generate an answer using the found context
      const answer = await this.generateAnswer(question, searchResults);
      
      // Format the response
      const response = {
        success: true,
        answer: answer,
        context: includeContext ? searchResults : null
      };
      
      return {
        role: this.role,
        content: JSON.stringify(response)
      };
    } catch (error: any) {
      console.error('Error in QuestionAnsweringAgent:', error);
      return {
        role: this.role,
        content: JSON.stringify({
          success: false,
          error: `Error processing question: ${error.message}`,
          answer: null,
          context: null
        })
      };
    }
  }
  
  /**
   * Generate an answer to a question based on search results
   */
  private async generateAnswer(question: string, searchResults: SearchResult[]): Promise<string> {
    try {
      // Format the context from search results
      const context = searchResults
        .map((result, index) => {
          const source = result.metadata?.title || `Document ${index + 1}`;
          const type = result.metadata?.source?.includes('company') 
            ? 'Company Document' 
            : 'Tender Document';
          return `[${type}: ${source}]\n${result.content}`;
        })
        .join('\n\n');
      
      // Generate the answer using Google's Gemini
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
      
      const prompt = `
        You are tasked with answering questions about tender preparation and company information.
        
        QUESTION: "${question}"
        
        CONTEXT:
        ${context}
        
        Based ONLY on the provided context, answer the question accurately and concisely.
        If the answer is not in the context, say "I don't have that information in the available documents."
        Provide a direct response without mentioning the context itself or phrases like "Based on the provided context..."
      `;
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      return responseText.trim();
    } catch (error: any) {
      console.error("Error generating answer:", error);
      return "I'm sorry, I was unable to generate an answer due to a technical error.";
    }
  }
  
  /**
   * Format a question message for this agent
   */
  static formatQuestionMessage(question: string, documentType: 'company' | 'source' | 'all' = 'all', limit: number = 5): AgentMessage {
    return {
      role: "orchestrator",
      content: JSON.stringify({
        question,
        documentType,
        limit,
        includeContext: false
      })
    };
  }
} 