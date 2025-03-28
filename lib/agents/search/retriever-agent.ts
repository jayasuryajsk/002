import { BaseAgent } from "../core/base-agent";
import type { AgentMessage } from "../types";
import { LlamaCloudIndex, ContextChatEngine } from "llamaindex";

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
  private llamaCloudIndex: LlamaCloudIndex;
  private chatEngine: ContextChatEngine;
  
  constructor() {
    super(
      "retriever",
      "You are a document retrieval agent that finds relevant information from the knowledge base.",
      "gemini-2.0-flash-001"
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
  }
  
  /**
   * Process a message containing search requirements and return relevant documents
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    try {
      const data = typeof message.content === 'string' 
        ? JSON.parse(message.content) 
        : message.content;
      
      const { action, query, options = {} } = data;
      
      switch (action) {
        case "search":
          return await this.handleSearch(query, options);
        case "retrieveContext":
          return await this.handleContextRetrieval(query, options);
        default:
          throw new Error(`Unsupported action: ${action}`);
      }
    } catch (error) {
      console.error("RetrieverAgent error:", error);
      return {
        role: this.role,
        content: JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error occurred",
          success: false,
          documents: []
        })
      };
    }
  }
  
  private async handleSearch(query: string, options: any): Promise<AgentMessage> {
    try {
      // Use LlamaCloud's retriever for semantic search
      const results = await this.llamaCloudIndex.asRetriever({
        similarityTopK: options.limit || 5,
      }).retrieve(query);

      return {
        role: this.role,
        content: JSON.stringify({
          success: true,
          documents: results,
          query
        })
      };
    } catch (error) {
      console.error("Search error:", error);
      throw error;
    }
  }

  private async handleContextRetrieval(query: string, options: any): Promise<AgentMessage> {
    try {
      // Use chat engine for more contextual retrieval
      const response = await this.chatEngine.chat({
        message: query,
        stream: false
      });

      return {
        role: this.role,
        content: JSON.stringify({
          success: true,
          context: response.response,
          sourceNodes: response.sourceNodes,
          query
        })
      };
    } catch (error) {
      console.error("Context retrieval error:", error);
      throw error;
    }
  }
} 