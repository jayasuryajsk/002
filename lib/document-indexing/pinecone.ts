import { PineconeStore } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { SourceDocument } from '../agents/types';
import { chunkText } from './processor';

// Initialize Pinecone client with proper configuration
console.log('DEBUG: Initializing Pinecone client with API key length:', process.env.PINECONE_API_KEY ? process.env.PINECONE_API_KEY.length : 0);
console.log('DEBUG: Using index name:', process.env.PINECONE_INDEX_NAME || 'tender-documents');

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

// Initialize embeddings with Google AI
console.log('DEBUG: Initializing Google embeddings with API key length:', process.env.GOOGLE_API_KEY ? process.env.GOOGLE_API_KEY.length : 0);
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  modelName: 'embedding-001',
});

// Index name to use in Pinecone
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'tender-documents';

// Ensure index exists (non-blocking initialization)
export async function ensurePineconeIndex() {
  try {
    // List existing indexes
    const existingIndexes = await pinecone.listIndexes();
    
    // Check if our index exists
    const indexExists = existingIndexes.indexes?.some(idx => idx.name === PINECONE_INDEX_NAME);
    
    if (!indexExists) {
      console.log(`Creating Pinecone index: ${PINECONE_INDEX_NAME}`);
      // Create the index with dimensions matching the Google embedding model (768 for embedding-001)
      await pinecone.createIndex({
        name: PINECONE_INDEX_NAME,
        dimension: 768,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });
      console.log(`Successfully created Pinecone index: ${PINECONE_INDEX_NAME}`);
    } else {
      console.log(`Pinecone index ${PINECONE_INDEX_NAME} already exists`);
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring Pinecone index exists:', error);
    return false;
  }
}

// Initialize on module load
ensurePineconeIndex().catch(err => {
  console.error('Failed to initialize Pinecone index:', err);
});

// Store documents in Pinecone vector database
export async function storeDocumentsInPinecone(documents: SourceDocument[]) {
  try {
    console.log(`DEBUG: PINECONE STORE - Starting to store ${documents.length} documents in Pinecone...`);
    console.log('DEBUG: PINECONE ENV - API Key exists:', !!process.env.PINECONE_API_KEY);
    console.log('DEBUG: PINECONE ENV - Index name:', PINECONE_INDEX_NAME);
    
    // Get the index
    console.log('DEBUG: PINECONE STORE - Getting index:', PINECONE_INDEX_NAME);
    const index = pinecone.index(PINECONE_INDEX_NAME);
    console.log('DEBUG: PINECONE STORE - Successfully got index reference');
    
    let totalChunks = 0;
    
    for (const doc of documents) {
      // Check if document is a PDF
      const isPDF = doc.type === 'pdf' || 
                 (doc.metadata?.fileType && doc.metadata.fileType.includes('pdf')) ||
                 (doc.metadata?.mimeType && doc.metadata.mimeType.includes('pdf'));
      
      let textContent = doc.content;
      
      // If PDF with placeholder content, try to extract real content
      if (isPDF && (textContent === 'PDF document - binary content' || !textContent)) {
        console.log(`PDF document detected: ${doc.title}. Skipping for now.`);
        // In a full implementation, you would have PDF text extraction here
        continue;
      }
      
      // Skip if no meaningful content
      if (!textContent || textContent.length < 10) {
        console.warn(`Document ${doc.title} has insufficient content for indexing`);
        continue;
      }
      
      // Split the document into chunks
      const textChunks = chunkText(textContent);
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
      
      // Create vectors in batches
      let batchSize = 100; // Adjust based on your Pinecone plan limits
      
      for (let i = 0; i < textChunks.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batchTexts = textChunks.slice(i, i + batchSize);
        const batchMetadatas = metadatas.slice(i, i + batchSize);
        
        // Store in Pinecone
        await PineconeStore.fromTexts(
          batchTexts,
          batchMetadatas,
          embeddings,
          {
            pineconeIndex: index,
          }
        );
        
        console.log(`Stored batch ${i / batchSize + 1} of ${Math.ceil(textChunks.length / batchSize)} for document ${doc.title}`);
      }
      
      totalChunks += textChunks.length;
    }
    
    console.log(`Successfully stored ${totalChunks} chunks from ${documents.length} documents in Pinecone`);
    return totalChunks;
  } catch (error: any) {
    console.error('ERROR: PINECONE STORE - Failed to store documents in Pinecone:');
    console.error('ERROR: PINECONE STORE - Error message:', error.message);
    console.error('ERROR: PINECONE STORE - Error stack:', error.stack);
    console.error('ERROR: PINECONE STORE - Error status:', error.status);
    console.error('ERROR: PINECONE STORE - Error name:', error.name);
    if (error.response) {
      console.error('ERROR: PINECONE STORE - Response data:', error.response.data);
      console.error('ERROR: PINECONE STORE - Response status:', error.response.status);
    }
    throw error;
  }
}

// Search for relevant documents in Pinecone
export async function searchPineconeDocuments(query: string, k = 10) {
  try {
    console.log(`DEBUG: PINECONE SEARCH - Searching for documents relevant to query: "${query.substring(0, 50)}..."`);
    console.log('DEBUG: PINECONE SEARCH - API Key exists:', !!process.env.PINECONE_API_KEY);
    console.log('DEBUG: PINECONE SEARCH - Index name:', PINECONE_INDEX_NAME);
    
    // Get the index
    console.log('DEBUG: PINECONE SEARCH - Getting index:', PINECONE_INDEX_NAME);
    const index = pinecone.index(PINECONE_INDEX_NAME);
    console.log('DEBUG: PINECONE SEARCH - Successfully got index reference');
    
    // Create vector store from existing index
    const vectorStore = await PineconeStore.fromExistingIndex(
      embeddings,
      { pineconeIndex: index }
    );
    
    // Search for similar documents
    const results = await vectorStore.similaritySearch(query, k);
    console.log(`Found ${results.length} relevant document chunks`);
    
    return results;
  } catch (error: any) {
    console.error('ERROR: PINECONE SEARCH - Failed to search Pinecone documents:');
    console.error('ERROR: PINECONE SEARCH - Error message:', error.message);
    console.error('ERROR: PINECONE SEARCH - Error stack:', error.stack);
    console.error('ERROR: PINECONE SEARCH - Error status:', error.status);
    console.error('ERROR: PINECONE SEARCH - Error name:', error.name);
    if (error.response) {
      console.error('ERROR: PINECONE SEARCH - Response data:', error.response.data);
      console.error('ERROR: PINECONE SEARCH - Response status:', error.response.status);
    }
    throw error;
  }
}

// Delete all vectors for a specific document
export async function deleteDocumentFromPinecone(documentId: string) {
  try {
    console.log(`Deleting document ${documentId} from Pinecone...`);
    
    // Get the index
    const index = pinecone.index(PINECONE_INDEX_NAME);
    
    // Delete by metadata filter
    await index.namespace('').deleteMany({
      filter: {
        id: { $eq: documentId }
      }
    });
    
    console.log(`Successfully deleted document ${documentId} from Pinecone`);
    return true;
  } catch (error) {
    console.error(`Error deleting document ${documentId} from Pinecone:`, error);
    return false;
  }
}

// Clear all documents from Pinecone (useful for testing or resetting)
export async function clearPineconeDocuments() {
  try {
    console.log('Clearing all documents from Pinecone...');
    
    // Get the index
    const index = pinecone.index(PINECONE_INDEX_NAME);
    
    // Delete all vectors
    await index.namespace('').deleteAll();
    
    console.log('Successfully cleared all documents from Pinecone');
    return true;
  } catch (error) {
    console.error('Error clearing Pinecone documents:', error);
    return false;
  }
} 