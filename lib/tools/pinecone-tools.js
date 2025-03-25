// Pinecone-related tools for use by agents
const { z } = require('zod');
const { PineconeSearchAgent } = require('../agents/pinecone-search-agent');

// Initialize a shared search agent for all tools to use
const searchAgent = new PineconeSearchAgent();

/**
 * Search tool - Find relevant documents in Pinecone
 */
const searchTool = {
  name: 'search',
  description: 'Search for relevant documents in Pinecone vector database',
  parameters: z.object({
    query: z.string().describe('The search query to find relevant information'),
    documentType: z.enum(['company', 'source', 'all']).default('all')
      .describe('Type of documents to search: company docs, source docs, or all'),
    limit: z.number().min(1).max(10).default(5)
      .describe('Maximum number of results to return')
  }),
  execute: async ({ query, documentType, limit }) => {
    try {
      const results = await searchAgent.search(query, { limit, includeMetadata: true }, documentType);
      
      // Format results for better consumption
      return {
        success: true,
        count: results.length,
        results: results.map(doc => ({
          content: doc.content,
          relevance: Math.round(doc.score * 100) / 100,
          title: doc.metadata?.title || 'Untitled',
          source: doc.metadata?.source || 'unknown'
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }
};

/**
 * Answer tool - Get an answer to a question using Pinecone documents
 */
const answerTool = {
  name: 'answer_question',
  description: 'Answer a question using information from the Pinecone knowledge base',
  parameters: z.object({
    question: z.string().describe('The question to answer'),
    documentType: z.enum(['company', 'source', 'all']).default('all')
      .describe('Type of documents to search: company docs, source docs, or all'),
    limit: z.number().min(1).max(10).default(5)
      .describe('Maximum number of documents to consider')
  }),
  execute: async ({ question, documentType, limit }) => {
    try {
      // First search for relevant documents
      const results = await searchAgent.search(question, { limit, includeMetadata: true }, documentType);
      
      if (results.length === 0) {
        return {
          success: false,
          answer: "I couldn't find any relevant information to answer this question.",
          sources: []
        };
      }
      
      // Format the context from search results
      const context = results
        .map((result, index) => {
          const source = result.metadata?.title || `Document ${index + 1}`;
          const type = result.metadata?.source?.includes('company') 
            ? 'Company Document' 
            : 'Tender Document';
          return `[${type}: ${source}]\n${result.content}`;
        })
        .join('\n\n');
      
      // Use the search agent's model to generate an answer
      const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(googleApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
      
      const prompt = `
        Answer this question based only on the provided information:
        
        QUESTION: "${question}"
        
        INFORMATION:
        ${context}
        
        Your answer should be:
        1. Accurate and based only on the provided information
        2. Concise but complete
        3. In a professional tone
        
        If you cannot answer the question based on the provided information, say so.
      `;
      
      const result = await model.generateContent(prompt);
      const answer = result.response.text().trim();
      
      // Format and return the answer with sources
      return {
        success: true,
        answer,
        sources: results.map(doc => ({
          title: doc.metadata?.title || 'Untitled',
          source: doc.metadata?.source || 'unknown',
          relevance: Math.round(doc.score * 100) / 100
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        answer: "I encountered an error while trying to answer your question."
      };
    }
  }
};

/**
 * Extract requirements tool - Get requirements from documents
 */
const extractRequirementsTool = {
  name: 'extract_requirements',
  description: 'Extract requirements from relevant documents',
  parameters: z.object({
    topic: z.string().describe('The topic or section to extract requirements for'),
    documentType: z.enum(['company', 'source', 'all']).default('source')
      .describe('Type of documents to search (usually source for requirements)'),
    limit: z.number().min(1).max(10).default(5)
      .describe('Maximum number of documents to consider')
  }),
  execute: async ({ topic, documentType, limit }) => {
    try {
      // First search for relevant documents
      const results = await searchAgent.search(topic, { limit, includeMetadata: true }, documentType);
      
      if (results.length === 0) {
        return {
          success: false,
          message: "Couldn't find relevant documents to extract requirements from.",
          requirements: []
        };
      }
      
      // Use the extractRequirements function from the search agent
      const requirements = await searchAgent.extractRequirements(results);
      
      return {
        success: true,
        count: requirements.length,
        requirements,
        sources: results.map(doc => ({
          title: doc.metadata?.title || 'Untitled',
          source: doc.metadata?.source || 'unknown'
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        requirements: []
      };
    }
  }
};

/**
 * Generate tender section tool - Create a section for a tender document
 */
const generateSectionTool = {
  name: 'generate_tender_section',
  description: 'Generate a complete section for a tender document',
  parameters: z.object({
    title: z.string().describe('The title of the section to generate'),
    query: z.string().optional().describe('Search query to find relevant information'),
    documentTypes: z.array(z.enum(['company', 'source', 'all'])).default(['all'])
      .describe('Types of documents to use for generation'),
    requirements: z.array(z.string()).optional()
      .describe('Specific requirements this section must address')
  }),
  execute: async ({ title, query, documentTypes, requirements = [] }) => {
    try {
      const finalQuery = query || title;
      let allResults = [];
      
      // Search across all specified document types
      for (const docType of documentTypes) {
        const results = await searchAgent.search(finalQuery, { 
          limit: 3, 
          includeMetadata: true 
        }, docType);
        
        allResults = [...allResults, ...results];
      }
      
      // If no requirements were provided, try to extract them
      let finalRequirements = requirements;
      if (finalRequirements.length === 0 && allResults.length > 0) {
        finalRequirements = await searchAgent.extractRequirements(allResults);
      }
      
      // Generate the section content
      const sectionContent = await searchAgent.generateTenderSection(
        title,
        allResults, 
        finalRequirements
      );
      
      return {
        success: true,
        title,
        content: sectionContent,
        requirements: finalRequirements,
        sources: allResults.map(doc => ({
          title: doc.metadata?.title || 'Untitled',
          source: doc.metadata?.source || 'unknown',
          relevance: Math.round(doc.score * 100) / 100
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        title,
        content: `## ${title}\n\nFailed to generate this section due to an error.`
      };
    }
  }
};

// Export all tools
module.exports = {
  searchTool,
  answerTool,
  extractRequirementsTool,
  generateSectionTool,
  
  // Also export a list of all tools for easy import
  pineconeTools: [
    searchTool,
    answerTool,
    extractRequirementsTool,
    generateSectionTool
  ]
}; 