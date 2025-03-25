import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateEmbeddings } from "../document-indexing/processor";
import { supabase } from "../document-indexing/supabase";

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

interface SearchOptions {
  threshold?: number;
  limit?: number;
  docType?: string;
  groupByDocument?: boolean;
  includeMetadata?: boolean;
}

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
  chunks?: Array<{
    id: string;
    content: string;
    similarity: number;
  }>;
}

/**
 * VectorSearchAgent - A class for semantic search over indexed documents
 * 
 * This agent provides methods to search through the vector database
 * and retrieve relevant document chunks based on semantic similarity.
 */
export class VectorSearchAgent {
  /**
   * Search for documents semantically similar to the query
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const {
        threshold = 0.7,
        limit = 5,
        docType,
        groupByDocument = false,
        includeMetadata = true
      } = options;
      
      // Generate embedding for the query
      const queryEmbedding = await generateEmbeddings(query);
      
      // Prepare filters
      const filters: Record<string, any> = {};
      if (docType) {
        filters['metadata.docType'] = docType;
      }
      
      // Call the match_documents function
      let { data, error } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit * 2 // Fetch more than needed to allow for filtering
      });
      
      if (error) {
        console.error('Search error:', error);
        throw new Error(`Search failed: ${error.message}`);
      }
      
      // Apply additional filters if provided
      if (data && Object.keys(filters).length > 0) {
        data = data.filter((item: any) => {
          // Check each filter condition
          for (const [key, value] of Object.entries(filters)) {
            // Handle nested metadata properties with dot notation (e.g., "metadata.docType")
            if (key.includes('.')) {
              const [parent, child] = key.split('.');
              if (parent === 'metadata' && item.metadata) {
                if (item.metadata[child] !== value) {
                  return false;
                }
              }
            } 
            // Handle direct properties
            else if (item[key] !== value) {
              return false;
            }
          }
          return true;
        });
      }
      
      // Group by document if requested
      let results = data || [];
      if (groupByDocument && results.length > 0) {
        const documentGroups: Record<string, any> = {};
        
        // Group chunks by parent document
        results.forEach((item: any) => {
          const parentId = item.metadata?.parent_id || item.id.split('_chunk_')[0];
          
          if (!documentGroups[parentId]) {
            documentGroups[parentId] = {
              id: parentId,
              title: item.metadata?.title || item.metadata?.fileName || 'Untitled Document',
              chunks: [],
              maxSimilarity: 0,
              metadata: item.metadata
            };
          }
          
          // Add chunk to document group
          documentGroups[parentId].chunks.push({
            id: item.id,
            content: item.content,
            similarity: item.similarity
          });
          
          // Update max similarity score
          if (item.similarity > documentGroups[parentId].maxSimilarity) {
            documentGroups[parentId].maxSimilarity = item.similarity;
          }
        });
        
        // Convert to array and sort by max similarity
        results = Object.values(documentGroups)
          .sort((a, b) => b.maxSimilarity - a.maxSimilarity)
          .slice(0, limit);
      } else {
        // Take only up to limit results after filtering
        results = results.slice(0, limit);
      }
      
      // Format the results
      return results.map((item: any) => {
        const result: SearchResult = {
          id: item.id,
          content: item.content,
          score: item.similarity || item.maxSimilarity
        };
        
        // Include metadata if requested
        if (includeMetadata) {
          result.metadata = item.metadata;
        }
        
        // Include chunks if grouped by document
        if (groupByDocument && item.chunks) {
          result.chunks = item.chunks;
        }
        
        return result;
      });
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
  async extractRequirements(documents: SearchResult[]): Promise<string[]> {
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
      const response = result.response.text();
      
      try {
        // Extract the JSON from the response
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                          response.match(/```\n([\s\S]*?)\n```/) || 
                          response.match(/(\[[\s\S]*\])/);
        
        const jsonStr = jsonMatch ? jsonMatch[1] : response;
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
      
      // Generate section content using Gemini
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
      
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
      
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Section generation error:", error);
      return `Failed to generate section "${sectionTitle}" due to an error.`;
    }
  }
}
