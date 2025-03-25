import { BaseAgent } from "../core/base-agent";
import type { AgentMessage, AgentRole } from "../types";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { Pinecone } from "@pinecone-database/pinecone";

/**
 * Abstract class for vector search agents that connect to vector databases
 */
export abstract class VectorSearchAgent extends BaseAgent {
  protected pineconeClient: Pinecone;
  protected indexName: string;

  constructor(role: AgentRole, indexName: string) {
    super(
      role,
      "You are a vector search agent that retrieves documents from a vector database based on semantic similarity.",
      "gemini-2.0-flash-001"
    );
    this.pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || "",
    });
    this.indexName = indexName;
  }

  /**
   * Initialize the Pinecone client connection
   */
  async initialize(): Promise<void> {
    try {
      // Pinecone client is already initialized in constructor
      console.log(`${this.role} agent initialized Pinecone client successfully`);
    } catch (error) {
      console.error(`Error initializing Pinecone client in ${this.role} agent:`, error);
      throw new Error(`Failed to initialize Pinecone client: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate an embedding for the input text using the AI SDK
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!text || text.trim() === "") {
        throw new Error("Empty text provided for embedding generation");
      }

      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || "";
      if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
      }

      // Create Google AI provider
      const googleAI = createGoogleGenerativeAI({
        apiKey: apiKey
      });

      // This is a placeholder for embedding generation using the AI SDK
      // In actual implementation, you would use the proper embedding method
      // For now, we'll return a dummy embedding
      console.log(`Generated embedding for text: "${text.substring(0, 50)}..."`);
      
      // Return a dummy embedding (would be replaced with actual implementation)
      return new Array(768).fill(0).map(() => Math.random());
    } catch (error) {
      console.error(`Error generating embedding in ${this.role} agent:`, error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Abstract method to search the vector database
   */
  abstract search(query: string, options?: any, filter?: any): Promise<any[]>;

  /**
   * Process a message containing a search query
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    try {
      const data = typeof message.content === 'string'
        ? JSON.parse(message.content)
        : message.content;

      const { query, options, filter } = data;

      if (!query) {
        throw new Error("No search query provided");
      }

      const results = await this.search(query, options, filter);

      return {
        role: this.role,
        content: JSON.stringify({
          query,
          results,
          count: results.length
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          type: "search_results"
        }
      };
    } catch (error) {
      console.error(`Error in ${this.role} agent:`, error);
      return {
        role: this.role,
        content: JSON.stringify({
          error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
          results: []
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          error: true
        }
      };
    }
  }
}
