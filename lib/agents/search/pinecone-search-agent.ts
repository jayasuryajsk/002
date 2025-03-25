import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import fs from 'fs';
import path from 'path';
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

// Helper function to read API keys directly from .env file
function getDirectEnvValue(key: string): string | null {
  try {
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(new RegExp(`${key}=([^\\r\\n]+)`));
    return match ? match[1] : null;
  } catch (error) {
    console.error(`Error reading ${key} from .env file:`, error);
    return null;
  }
}

// Update model name for consistency
const MODEL_NAME = "gemini-2.0-flash-001";

interface SearchOptions {
  threshold?: number;
  limit?: number;
  includeMetadata?: boolean;
}

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

interface SourceDocument {
  id: string;
  title: string;
  content: string;
  type: string;
  metadata: Record<string, any>;
}

/**
 * PineconeSearchAgent - A class for semantic search over indexed documents in Pinecone
 * 
 * This agent provides methods to search through the Pinecone vector database
 * and retrieve relevant document chunks based on semantic similarity.
 */
export class PineconeSearchAgent {
  private initialized: boolean = false;
  private pinecone: Pinecone | null = null;
  private index: any = null;
  private embeddings: GoogleGenerativeAIEmbeddings | null = null;
  
  constructor() {
    this.initialize();
  }
  
  /**
   * Initialize Pinecone client and embeddings model
   */
  private async initialize() {
    try {
      // Get API keys from env or direct file reading
      const pineconeApiKey = getDirectEnvValue('PINECONE_API_KEY') || process.env.PINECONE_API_KEY || '';
      const indexName = getDirectEnvValue('PINECONE_INDEX_NAME') || process.env.PINECONE_INDEX_NAME || 'tender-documents';
      const googleApiKey = getDirectEnvValue('GOOGLE_GENERATIVE_AI_API_KEY') || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
      
      if (!pineconeApiKey) {
        console.error('Pinecone API key not found');
        return;
      }
      
      if (!googleApiKey) {
        console.error('Google API key not found');
        return;
      }
      
      // Initialize Pinecone
      this.pinecone = new Pinecone({
        apiKey: pineconeApiKey,
      });
      
      // Initialize embeddings
      this.embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: googleApiKey,
        modelName: 'text-embedding-004',
      });
      
      // Initialize index
      this.index = this.pinecone.index(indexName);
      
      this.initialized = true;
      console.log('PineconeSearchAgent initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PineconeSearchAgent:', error);
    }
  }
  
  /**
   * Generate embedding for a text
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embeddings) {
      throw new Error('Embeddings model not initialized');
    }
    
    try {
      const embedding = await this.embeddings.embedQuery(text);
      
      // Verify that the embedding dimension matches what's expected by Pinecone (768)
      if (embedding.length !== 768) {
        console.warn(`Warning: Generated embedding has ${embedding.length} dimensions, but Pinecone expects 768 dimensions.`);
        
        // If longer, truncate to 768
        if (embedding.length > 768) {
          return embedding.slice(0, 768);
        }
        
        // If shorter, pad with zeros (unlikely case)
        if (embedding.length < 768) {
          return [...embedding, ...Array(768 - embedding.length).fill(0)];
        }
      }
      
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Search for documents semantically similar to the query
   */
  async search(query: string, options: SearchOptions = {}, documentType: 'company' | 'source' | 'all' = 'all'): Promise<SearchResult[]> {
    try {
      // Wait for initialization if needed
      if (!this.initialized || !this.pinecone || !this.index || !this.embeddings) {
        await this.initialize();
        
        // Check again after initialization attempt
        if (!this.initialized || !this.pinecone || !this.index || !this.embeddings) {
          throw new Error('PineconeSearchAgent failed to initialize');
        }
      }
      
      const {
        threshold = 0.7,
        limit = 5,
        includeMetadata = true
      } = options;
      
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Create filter based on document type
      let filter = {};
      if (documentType === 'company') {
        filter = { source: { $eq: 'company-docs' } };
      } else if (documentType === 'source') {
        filter = { source: { $eq: 'tender-docs' } };
      }
      
      // Query Pinecone
      const queryResult = await this.index.query({
        vector: queryEmbedding,
        topK: limit,
        includeMetadata: includeMetadata,
        includeValues: false,
        filter: documentType !== 'all' ? filter : undefined
      });
      
      // Format the results
      const results = queryResult.matches.map((match: any) => {
        const result: SearchResult = {
          id: match.id,
          content: match.metadata?.text || 'No content available',
          score: match.score
        };
        
        if (includeMetadata) {
          result.metadata = match.metadata;
        }
        
        return result;
      });
      
      console.log(`Found ${results.length} ${documentType} documents matching query: "${query.substring(0, 50)}..."`);
      
      return results;
    } catch (error) {
      console.error("Search error:", error);
      throw error;
    }
  }
  
  /**
   * Generate a summary of multiple documents
   */
  async summarizeDocuments(documents: SearchResult[], query: string): Promise<string> {
    try {
      // Prepare the documents for summarization
      const documentTexts = documents.map((doc, index) => {
        return `Document ${index + 1} (Relevance: ${doc.score.toFixed(2)}):\n${doc.content.slice(0, 1000)}${doc.content.length > 1000 ? '...' : ''}`;
      }).join('\n\n');
      
      // Get API key
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || getDirectEnvValue('GOOGLE_GENERATIVE_AI_API_KEY') || "";
      if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
      }
      
      // Create Google AI provider
      const googleAI = createGoogleGenerativeAI({
        apiKey: apiKey
      });
      
      const prompt = `
        I need a comprehensive summary of the following documents in relation to this query: "${query}"
        
        ${documentTexts}
        
        Please provide:
        1. A concise summary of the key information from these documents that's relevant to the query
        2. Important points that should be considered when addressing the query
        3. Any contradictions or gaps in the information
        
        Format your response as a well-structured summary that could be used in a tender document.
      `;
      
      // Generate content using the AI SDK
      const result = await generateText({
        model: googleAI(MODEL_NAME),
        prompt: prompt,
      });
      
      return result.text;
    } catch (error) {
      console.error("Summarization error:", error);
      return "Failed to generate summary due to an error.";
    }
  }
  
  /**
   * Extract key requirements from documents
   */
  async extractRequirements(documents: SearchResult[]): Promise<string[]> {
    try {
      // Prepare the documents for requirement extraction
      const documentTexts = documents.map((doc, index) => {
        return `Document ${index + 1}:\n${doc.content.slice(0, 1500)}${doc.content.length > 1500 ? '...' : ''}`;
      }).join('\n\n');
      
      // Get API key
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || getDirectEnvValue('GOOGLE_GENERATIVE_AI_API_KEY') || "";
      if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
      }
      
      // Create Google AI provider
      const googleAI = createGoogleGenerativeAI({
        apiKey: apiKey
      });
      
      const prompt = `
        Extract all explicit and implicit requirements from the following documents:
        
        ${documentTexts}
        
        For each requirement:
        1. State it clearly and concisely
        2. Indicate if it's mandatory or optional (when specified)
        3. Include any metrics, deadlines, or specific constraints mentioned
        
        Format your response as a JSON array of requirement strings.
        Example: ["Must provide 24/7 customer support", "System uptime must be at least 99.9%"]
      `;
      
      // Generate content using the AI SDK
      const result = await generateText({
        model: googleAI(MODEL_NAME),
        prompt: prompt,
      });
      
      try {
        // Extract the JSON from the response
        const jsonMatch = result.text.match(/```json\n([\s\S]*?)\n```/) || 
                          result.text.match(/```\n([\s\S]*?)\n```/) || 
                          result.text.match(/(\[[\s\S]*\])/);
        
        const jsonStr = jsonMatch ? jsonMatch[1] : result.text;
        const requirements = JSON.parse(jsonStr);
        
        return Array.isArray(requirements) ? requirements : [];
      } catch (parseError) {
        console.error('Error parsing requirements:', parseError);
        return [];
      }
    } catch (error) {
      console.error("Requirements extraction error:", error);
      return [];
    }
  }
  
  /**
   * Generate a tender section based on relevant documents
   */
  async generateTenderSection(sectionTitle: string, relevantDocuments: SearchResult[]): Promise<string> {
    try {
      // Prepare the documents for section generation
      const documentTexts = relevantDocuments.map((doc, index) => {
        return `Document ${index + 1} (Relevance: ${doc.score.toFixed(2)}):\n${doc.content.slice(0, 1500)}${doc.content.length > 1500 ? '...' : ''}`;
      }).join('\n\n');
      
      // Get API key
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || getDirectEnvValue('GOOGLE_GENERATIVE_AI_API_KEY') || "";
      if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
      }
      
      // Create Google AI provider
      const googleAI = createGoogleGenerativeAI({
        apiKey: apiKey
      });
      
      const prompt = `
        Generate a professional tender section titled "${sectionTitle}" based on the following reference documents:
        
        ${documentTexts}
        
        Your task is to:
        1. Create a well-structured section that addresses all requirements related to "${sectionTitle}"
        2. Include specific details from the reference documents where relevant
        3. Use professional, clear language appropriate for a formal tender response
        4. Be comprehensive but concise
        5. Format the content with appropriate headings and bullet points where needed
        
        The section should demonstrate a deep understanding of the requirements and present a compelling solution.
      `;
      
      // Generate content using the AI SDK
      const result = await generateText({
        model: googleAI(MODEL_NAME),
        prompt: prompt,
      });
      
      return result.text;
    } catch (error) {
      console.error("Section generation error:", error);
      return `Failed to generate section "${sectionTitle}" due to an error.`;
    }
  }

  /**
   * Get all documents from the index
   */
  async getAllDocuments(): Promise<SourceDocument[]> {
    try {
      // Wait for initialization if needed
      if (!this.initialized || !this.pinecone || !this.index) {
        await this.initialize();
        
        // Check again after initialization attempt
        if (!this.initialized || !this.pinecone || !this.index) {
          console.warn('PineconeSearchAgent failed to initialize, using fallback documents');
          return this.createFallbackDocuments();
        }
      }
      
      try {
        console.log("Querying Pinecone with default vector");
        
        // Use a simple approach with a constant vector - focus on reliability
        const fixedDimension = 768; // Standard dimension for text-embedding models
        
        // Create a vector with all 0.1 values - a simple approach that often works
        // This isn't semantically meaningful but works for "get all" scenarios
        const queryVector = Array(fixedDimension).fill(0.1);
        
        // Query with a large limit to fetch as many documents as possible
        const queryResult = await this.index.query({
          vector: queryVector,
          topK: 1000,
          includeMetadata: true,
          includeValues: false
        });
        
        if (!queryResult.matches || queryResult.matches.length === 0) {
          console.log("No matches found in vector database, using fallback");
          return this.createFallbackDocuments();
        }
        
        // Format the results as SourceDocuments
        const documents: SourceDocument[] = queryResult.matches.map((match: any) => {
          return {
            id: match.id,
            title: match.metadata?.title || match.id,
            content: match.metadata?.text || 'No content available',
            type: match.metadata?.type || 'document',
            metadata: match.metadata || {}
          };
        });
        
        console.log(`Found ${documents.length} documents via query`);
        return documents;
      } catch (error) {
        console.error("Vector query failed, using fallback:", error);
        return this.createFallbackDocuments();
      }
    } catch (error) {
      console.error("Error getting all documents, using fallback:", error);
      return this.createFallbackDocuments();
    }
  }
  
  /**
   * Create fallback documents when vector database retrieval fails
   */
  private createFallbackDocuments(): SourceDocument[] {
    console.log("Creating fallback sample documents");
    
    // Create some sample documents to allow the system to proceed
    return [
      {
        id: "sample-doc-1",
        title: "Sample Tender Document",
        content: "This is a sample tender document created as a fallback when retrieval fails. " +
                "Please upload actual tender documents to improve results. " +
                "A tender document typically includes requirements, specifications, timelines, " +
                "evaluation criteria, and submission instructions.",
        type: "document",
        metadata: {
          dateAdded: new Date().toISOString(),
          fileType: "text",
          fileSize: 500,
          path: "fallback/sample-1.txt"
        }
      },
      {
        id: "sample-doc-2",
        title: "Sample Company Profile",
        content: "This is a sample company profile created as a fallback when retrieval fails. " +
                "Please upload your actual company documents to improve results. " +
                "A company profile typically includes history, expertise, past projects, " +
                "certifications, team qualifications, and unique selling points.",
        type: "company",
        metadata: {
          dateAdded: new Date().toISOString(),
          fileType: "text",
          fileSize: 500,
          path: "fallback/sample-2.txt"
        }
      }
    ];
  }
} 