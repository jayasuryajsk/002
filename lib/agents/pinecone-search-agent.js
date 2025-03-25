const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const fs = require('fs');
const path = require('path');

// Helper function to read API keys directly from .env file
function getDirectEnvValue(key) {
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

// Initialize Google AI
const apiKey = getDirectEnvValue('GOOGLE_GENERATIVE_AI_API_KEY') || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * PineconeSearchAgent - A class for semantic search over indexed documents in Pinecone
 * 
 * This agent provides methods to search through the Pinecone vector database
 * and retrieve relevant document chunks based on semantic similarity.
 */
class PineconeSearchAgent {
  constructor() {
    this.initialized = false;
    this.pinecone = null;
    this.index = null;
    this.embeddings = null;
    this.initialize();
  }
  
  /**
   * Initialize Pinecone client and embeddings model
   */
  async initialize() {
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
  async generateEmbedding(text) {
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
  async search(query, options = {}, documentType = 'all') {
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
      const results = queryResult.matches.map((match) => {
        const result = {
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
  async summarizeDocuments(documents, query) {
    try {
      // Prepare the documents for summarization
      const documentTexts = documents.map((doc, index) => {
        return `Document ${index + 1} (Relevance: ${doc.score.toFixed(2)}):\n${doc.content.slice(0, 1000)}${doc.content.length > 1000 ? '...' : ''}`;
      }).join('\n\n');
      
      // Generate a summary using Gemini
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
      
      const prompt = `
        I need a comprehensive summary of the following documents in relation to this query: "${query}"
        
        ${documentTexts}
        
        Please provide:
        1. A concise summary of the key information from these documents that's relevant to the query
        2. Important points that should be considered when addressing the query
        3. Any contradictions or gaps in the information
        
        Format your response as a well-structured summary that could be used in a tender document.
      `;
      
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Summarization error:", error);
      return "Failed to generate summary due to an error.";
    }
  }
  
  /**
   * Extract key requirements from documents
   */
  async extractRequirements(documents) {
    try {
      // Prepare the documents for requirement extraction
      const documentTexts = documents.map((doc, index) => {
        return `Document ${index + 1}:\n${doc.content.slice(0, 1500)}${doc.content.length > 1500 ? '...' : ''}`;
      }).join('\n\n');
      
      // Extract requirements using Gemini
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
      
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
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Extract JSON array from response
      try {
        const responseJson = JSON.parse(responseText);
        return Array.isArray(responseJson) ? responseJson : [];
      } catch (e) {
        // If direct parsing fails, try to extract array portion
        const match = responseText.match(/\[([\s\S]*)\]/);
        if (match) {
          try {
            return JSON.parse(`[${match[1]}]`);
          } catch (e2) {
            // If extraction fails too, fallback to regex extraction
            const requirements = [];
            const regex = /"([^"]*)"/g;
            let m;
            while ((m = regex.exec(responseText)) !== null) {
              requirements.push(m[1]);
            }
            return requirements;
          }
        }
        return [];
      }
    } catch (error) {
      console.error("Requirements extraction error:", error);
      return [];
    }
  }
  
  /**
   * Generate a tender section based on documents and requirements
   */
  async generateTenderSection(title, documents, requirements) {
    try {
      // Prepare the documents for the tender section generation
      const documentTexts = documents.map((doc, index) => {
        return `Document ${index + 1}:\n${doc.content.slice(0, 1500)}${doc.content.length > 1500 ? '...' : ''}`;
      }).join('\n\n');
      
      // Format requirements as a list
      const requirementsList = requirements.map((req, index) => `${index + 1}. ${req}`).join('\n');
      
      // Generate the section using Gemini
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
      
      const prompt = `
        Generate a professional tender document section titled "${title}" based on the following information and requirements.
        
        DOCUMENTS:
        ${documentTexts}
        
        REQUIREMENTS:
        ${requirementsList}
        
        Write a complete, detailed section that:
        1. Addresses all the listed requirements
        2. Uses information from the provided documents
        3. Is professionally formatted with appropriate headings, paragraphs, and bullet points
        4. Includes specific details and avoids vague statements
        5. Has a professional, confident tone appropriate for a tender document
        
        Format the section with Markdown, starting with a level 2 heading for the section title.
      `;
      
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Section generation error:", error);
      return `## ${title}\n\nFailed to generate this section due to an error.`;
    }
  }
}

module.exports = { PineconeSearchAgent }; 