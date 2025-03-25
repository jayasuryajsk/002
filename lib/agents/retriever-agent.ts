import { BaseAgent } from "./base-agent";
import { AgentMessage, SourceDocument, CompanyDocument } from "./types";
import { PineconeSearchAgent } from "./pinecone-search-agent";
import { LocalDocumentStorage } from "../local-storage";

// Import SearchResult interface from pinecone-search-agent
interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
  binaryData?: Buffer;
}

/**
 * RetrieverAgent - Specializes in semantic search and document retrieval
 * This agent focuses solely on finding the most relevant documents based on queries
 */
export class RetrieverAgent extends BaseAgent {
  private searchAgent: PineconeSearchAgent;
  
  constructor() {
    super(
      "retriever", 
      "You are an expert tender document retriever. Your role is to find the most relevant documents and information for tender preparation.",
      "gemini-2.0-flash-001",
      "You are an expert tender document retriever. Your role is to find the most relevant documents and information for tender preparation."
    );
    this.searchAgent = new PineconeSearchAgent();
  }
  
  /**
   * Process a message containing search requirements and return relevant documents
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    try {
      const data = typeof message.content === 'string' 
        ? JSON.parse(message.content) 
        : message.content;
      
      // Handle different actions
      if (data.action === "getAllDocuments") {
        return await this.getAllDocuments();
      } else if (data.action === "getCompanyDocuments") {
        return await this.getCompanyDocuments();
      }
        
      const { query, limit = 5, threshold = 0.7 } = data;
      
      // Perform the search
      const searchResults = await this.searchDocuments(query, limit);
      
      console.log(`RetrieverAgent found ${searchResults.length} relevant documents for query: "${query}"`);
      
      // Format the results for the next agent
      return {
        role: this.role,
        content: JSON.stringify({ 
          query, 
          results: searchResults,
          count: searchResults.length
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          count: searchResults.length,
          documentIds: searchResults.map(r => r.id)
        }
      };
    } catch (error) {
      console.error("RetrieverAgent error:", error);
      return {
        role: this.role,
        content: JSON.stringify({ 
          error: `Failed to retrieve documents: ${error instanceof Error ? error.message : String(error)}`,
          results: []
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          error: true
        }
      };
    }
  }
  
  /**
   * Get all documents from the vector database
   */
  private async getAllDocuments(): Promise<AgentMessage> {
    try {
      console.log("Attempting to get all documents");
      const documents = await this.searchAgent.getAllDocuments();
      
      console.log(`RetrieverAgent retrieved ${documents.length} documents`);
      
      // Check if we only got fallback documents (they have predefined IDs)
      const onlyFallbacks = documents.length > 0 && 
        documents.every(doc => doc.id.startsWith('sample-doc-'));
      
      if (documents.length === 0 || onlyFallbacks) {
        const message = onlyFallbacks ? 
          "Only fallback documents found. Please upload actual source documents." : 
          "No documents found in the vector database. Please upload source documents.";
          
        console.log(message);
        
        return {
          role: this.role,
          content: JSON.stringify({
            documents: documents,
            count: documents.length,
            message: message,
            onlyFallbacks: onlyFallbacks
          }),
          metadata: {
            timestamp: new Date().toISOString(),
            warning: true,
            count: documents.length,
            onlyFallbacks: onlyFallbacks
          }
        };
      }
      
      return {
        role: this.role,
        content: JSON.stringify({
          documents,
          count: documents.length
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          count: documents.length
        }
      };
    } catch (error) {
      console.error("Error getting all documents:", error);
      
      // Return a failing-gracefully message
      return {
        role: this.role,
        content: JSON.stringify({
          error: `Failed to get all documents: ${error instanceof Error ? error.message : String(error)}`,
          documents: [],
          count: 0
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          error: true
        }
      };
    }
  }
  
  /**
   * Get all company documents from local storage
   */
  private async getCompanyDocuments(): Promise<AgentMessage> {
    try {
      console.log("Attempting to get all company documents from local storage");
      const documents = await LocalDocumentStorage.getCompanyDocuments();
      
      console.log(`RetrieverAgent retrieved ${documents.length} company documents`);
      
      if (documents.length === 0) {
        const message = "No company documents found in local storage. Please upload company profile documents.";
        console.log(message);
        
        return {
          role: this.role,
          content: JSON.stringify({
            documents: [],
            count: 0,
            message: message
          }),
          metadata: {
            timestamp: new Date().toISOString(),
            warning: true,
            count: 0
          }
        };
      }
      
      return {
        role: this.role,
        content: JSON.stringify({
          documents,
          count: documents.length
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          count: documents.length
        }
      };
    } catch (error) {
      console.error("Error getting company documents:", error);
      
      // Return a failing-gracefully message
      return {
        role: this.role,
        content: JSON.stringify({
          error: `Failed to get company documents: ${error instanceof Error ? error.message : String(error)}`,
          documents: [],
          count: 0
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          error: true
        }
      };
    }
  }
  
  /**
   * Specialized method to extract requirements from documents
   */
  async extractRequirements(documents: SearchResult[]): Promise<string[]> {
    try {
      return await this.searchAgent.extractRequirements(documents);
    } catch (error) {
      console.error("Requirements extraction error:", error);
      return [];
    }
  }

  async searchDocuments(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      // Instead of using text search, get documents directly from storage
      const { LocalDocumentStorage } = await import('../local-storage');
      const sourceDocs = await LocalDocumentStorage.getSourceDocuments();
      
      console.log(`Searching across ${sourceDocs.length} documents for: ${query}`);
      
      // Format the results directly
      const results = sourceDocs.slice(0, limit).map(doc => ({
        id: doc.id,
        content: doc.content || "Binary document",
        score: 1.0,
        metadata: doc.metadata || {},
        binaryData: doc.binaryData // Include the binary data directly
      }));
      
      return results;
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    }
  }
} 