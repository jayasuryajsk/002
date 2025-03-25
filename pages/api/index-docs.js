// Using pages router API for document indexing with direct Pinecone initialization
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { LocalDocumentStorage } from '../../lib/local-storage';
import { chunkText } from '../../lib/document-indexing/processor';
import fs from 'fs';
import path from 'path';

// In-memory storage for documents
let sourceDocuments = [];
let documentsLoaded = false;
let documentsIndexed = false;

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

// Helper function to generate embeddings for a text
async function generateEmbedding(embeddings, text) {
  try {
    // Log the text length for debugging
    console.log(`Generating embedding for text of length: ${text.length}`);
    
    // Generate embedding
    const embedding = await embeddings.embedQuery(text);
    
    // Check if embedding has the correct dimension
    if (!embedding || embedding.length === 0) {
      console.error('Failed to generate embedding: returned empty vector');
      throw new Error('Empty embedding vector generated');
    }
    
    console.log(`Successfully generated embedding with dimension: ${embedding.length}`);
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

export default async function handler(req, res) {
  // Handle GET request
  if (req.method === 'GET') {
    console.log('Pages Router API: Document indexing GET request received');
    return res.status(200).json({ 
      message: "Document indexing API is working. Use POST to index documents." 
    });
  }
  
  // Handle POST request
  if (req.method === 'POST') {
    console.log('Pages Router API: Document indexing POST request received');
    
    try {
      // Parse request body
      const { action = 'index', refresh = false } = req.body;
      
      // Load documents if not already loaded or refresh is requested
      if (!documentsLoaded || refresh) {
        console.log('Loading documents from local storage...');
        sourceDocuments = await LocalDocumentStorage.getSourceDocuments();
        console.log(`Loaded ${sourceDocuments.length} source documents from local storage`);
        documentsLoaded = true;
      }
      
      // Check if we have source documents
      if (sourceDocuments.length === 0) {
        return res.status(400).json({
          error: 'No source documents found. Please upload source documents first.'
        });
      }
      
      // Direct Pinecone initialization using .env file
      console.log('Initializing Pinecone client directly in API handler...');
      const apiKey = getDirectEnvValue('PINECONE_API_KEY');
      const indexName = getDirectEnvValue('PINECONE_INDEX_NAME') || 'tender-documents';
      const googleApiKey = getDirectEnvValue('GOOGLE_API_KEY') || getDirectEnvValue('GOOGLE_GENERATIVE_AI_API_KEY');
      
      console.log(`API Key length: ${apiKey ? apiKey.length : 0}`);
      console.log(`Google API Key length: ${googleApiKey ? googleApiKey.length : 0}`);
      console.log(`Index name: ${indexName}`);
      
      if (!googleApiKey) {
        return res.status(400).json({
          error: 'Google API key is missing. Please add GOOGLE_GENERATIVE_AI_API_KEY to your .env file.'
        });
      }
      
      const pinecone = new Pinecone({
        apiKey: apiKey,
      });
      
      // Handle different actions
      if (action === 'clear') {
        // Clear existing documents
        console.log('Clearing existing documents from Pinecone...');
        const index = pinecone.index(indexName);
        await index.namespace('').deleteAll();
        documentsIndexed = false;
        
        return res.status(200).json({
          success: true,
          message: 'Cleared all documents from Pinecone'
        });
        
      } else if (action === 'index' || action === 'reindex') {
        // Index or reindex documents
        console.log(`${action === 'reindex' ? 'Re-indexing' : 'Indexing'} documents in Pinecone...`);
        
        // First ensure Pinecone index exists
        const existingIndexes = await pinecone.listIndexes();
        const indexExists = existingIndexes.indexes?.some(idx => idx.name === indexName);
        
        if (!indexExists) {
          console.log(`Creating Pinecone index: ${indexName}`);
          await pinecone.createIndex({
            name: indexName,
            dimension: 768,
            metric: 'cosine',
            spec: {
              serverless: {
                cloud: 'aws',
                region: 'us-east-1'
              }
            }
          });
          console.log(`Successfully created Pinecone index: ${indexName}`);
        } else {
          console.log(`Pinecone index ${indexName} already exists`);
        }
        
        // Initialize embeddings with direct API key
        console.log('Initializing Google GenerativeAI Embeddings...');
        const embeddings = new GoogleGenerativeAIEmbeddings({
          apiKey: googleApiKey,
          modelName: 'embedding-001',
        });
        
        // Test the embeddings with a sample text
        try {
          console.log('Testing embeddings with sample text...');
          const sampleEmbedding = await generateEmbedding(embeddings, 'This is a test sentence to verify embeddings are working correctly.');
          console.log(`Sample embedding dimension: ${sampleEmbedding.length}`);
          
          if (sampleEmbedding.length !== 768) {
            throw new Error(`Unexpected embedding dimension: ${sampleEmbedding.length}, expected 768`);
          }
        } catch (error) {
          console.error('Failed to generate test embedding:', error);
          return res.status(500).json({
            error: 'Failed to generate embeddings',
            details: error.message
          });
        }
        
        // Store documents in Pinecone
        const index = pinecone.index(indexName);
        let totalChunks = 0;
        let successfulChunks = 0;
        
        for (const doc of sourceDocuments) {
          // Skip if no meaningful content
          if (!doc.content || doc.content.length < 10) {
            console.warn(`Document ${doc.title} has insufficient content for indexing`);
            continue;
          }
          
          // Split the document into chunks
          const textChunks = chunkText(doc.content);
          console.log(`Split document ${doc.title} into ${textChunks.length} chunks`);
          
          // Create metadata for each chunk
          const metadatas = textChunks.map((_chunk, i) => ({
            id: doc.id,
            title: doc.title,
            type: doc.type,
            chunk: i,
            chunkTotal: textChunks.length,
            source: 'tender-docs',
            ...(doc.metadata || {})
          }));
          
          // Create ids for each chunk
          const ids = textChunks.map((_, i) => `${doc.id}-chunk-${i}`);
          
          // Store in Pinecone (smaller batches)
          const batchSize = 5; // Smaller batch size to avoid timeouts
          
          for (let i = 0; i < textChunks.length; i += batchSize) {
            const batchIds = ids.slice(i, i + batchSize);
            const batchTexts = textChunks.slice(i, i + batchSize);
            const batchMetadatas = metadatas.slice(i, i + batchSize);
            
            try {
              // Manual approach to embedding and storing
              console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(textChunks.length / batchSize)} for document ${doc.title}`);
              
              // Create vectors array
              const vectors = [];
              
              // Generate embeddings for each text in the batch
              for (let j = 0; j < batchTexts.length; j++) {
                try {
                  const values = await generateEmbedding(embeddings, batchTexts[j]);
                  
                  vectors.push({
                    id: batchIds[j],
                    values: values,
                    metadata: batchMetadatas[j]
                  });
                  
                  successfulChunks++;
                } catch (embeddingError) {
                  console.error(`Error generating embedding for chunk ${i + j} of document ${doc.title}:`, embeddingError.message);
                }
              }
              
              // Only upsert if we have vectors
              if (vectors.length > 0) {
                console.log(`Upserting ${vectors.length} vectors to Pinecone...`);
                await index.upsert(vectors);
                console.log(`Successfully upserted ${vectors.length} vectors to Pinecone`);
              } else {
                console.warn(`No valid vectors generated for batch ${i / batchSize + 1} of document ${doc.title}`);
              }
              
            } catch (err) {
              console.error(`Error storing batch for document ${doc.title}:`, err.message);
              // Continue with next batch
            }
          }
          
          totalChunks += textChunks.length;
        }
        
        documentsIndexed = true;
        
        return res.status(200).json({
          success: true,
          message: `Successfully processed ${sourceDocuments.length} documents with ${totalChunks} total chunks`,
          documentCount: sourceDocuments.length,
          totalChunks: totalChunks,
          successfulChunks: successfulChunks,
          note: successfulChunks < totalChunks ? "Some chunks failed to be indexed. Check server logs for details." : "All chunks indexed successfully."
        });
      } else {
        return res.status(400).json({
          error: 'Invalid action. Valid actions are "index", "reindex", or "clear".'
        });
      }
    } catch (error) {
      console.error('Error in Pages Router Index API:', error);
      return res.status(500).json({
        error: 'Failed to process indexing request',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  // Handle unsupported methods
  return res.status(405).json({ error: 'Method not allowed' });
}
