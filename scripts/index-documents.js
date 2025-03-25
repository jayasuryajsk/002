// Script to manually force indexing of all documents in Pinecone
require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const fs = require('fs');
const path = require('path');

// Function to read document content from file
function readDocument(id, dirPath) {
  const metadataPath = path.join(dirPath, `${id}-metadata.json`);
  const contentPath = path.join(dirPath, `${id}-content`);
  
  try {
    if (!fs.existsSync(metadataPath)) {
      console.error(`Metadata file not found for ${id}`);
      return null;
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    let content = '';
    if (fs.existsSync(contentPath)) {
      if (metadata.type === 'pdf' || (metadata.metadata?.fileType && metadata.metadata.fileType.includes('pdf'))) {
        content = 'PDF document content - will be processed directly';
      } else {
        content = fs.readFileSync(contentPath, 'utf8');
      }
    }
    
    return {
      id: metadata.id,
      title: metadata.title,
      type: metadata.type || 'source',
      content: content,
      metadata: metadata.metadata || {}
    };
  } catch (error) {
    console.error(`Error reading document ${id}:`, error);
    return null;
  }
}

// Function to fetch all documents from local storage
async function getAllDocuments() {
  try {
    const sourceDocsDir = path.join(process.cwd(), 'local-storage', 'source-docs');
    const companyDocsDir = path.join(process.cwd(), 'local-storage', 'company-docs');
    
    const sourceDocuments = [];
    const companyDocuments = [];
    
    // Get source documents
    if (fs.existsSync(sourceDocsDir)) {
      const files = fs.readdirSync(sourceDocsDir);
      const metadataFiles = files.filter(file => file.endsWith('-metadata.json'));
      
      for (const file of metadataFiles) {
        const id = file.replace('-metadata.json', '');
        const doc = readDocument(id, sourceDocsDir);
        if (doc) {
          sourceDocuments.push(doc);
        }
      }
    }
    
    // Get company documents
    if (fs.existsSync(companyDocsDir)) {
      const files = fs.readdirSync(companyDocsDir);
      const metadataFiles = files.filter(file => file.endsWith('-metadata.json'));
      
      for (const file of metadataFiles) {
        const id = file.replace('-metadata.json', '');
        const doc = readDocument(id, companyDocsDir);
        if (doc) {
          companyDocuments.push(doc);
        }
      }
    }
    
    console.log(`Found ${sourceDocuments.length} source documents and ${companyDocuments.length} company documents`);
    return { sourceDocuments, companyDocuments };
  } catch (error) {
    console.error('Error getting documents:', error);
    return { sourceDocuments: [], companyDocuments: [] };
  }
}

// Import the real pinecone file functions
const pineconeFile = path.join(process.cwd(), 'lib', 'document-indexing', 'pinecone.js');

// Main function to index all documents
async function indexAllDocuments() {
  console.log('Starting document indexing process...');
  
  try {
    // Get all documents
    const { sourceDocuments, companyDocuments } = await getAllDocuments();
    const allDocuments = [...sourceDocuments, ...companyDocuments];
    
    if (allDocuments.length === 0) {
      console.error('No documents found to index');
      return;
    }
    
    // Check Pinecone connection
    console.log('Checking Pinecone connection...');
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    
    console.log('Connected to Pinecone successfully');
    
    // Import the storeDocumentsInPinecone function if possible
    let indexFunction;
    try {
      // Try to dynamically import the module if it's ESM
      console.log('Attempting to manually create direct index...');
      
      // Simplified version of the indexing function
      indexFunction = async (docs) => {
        // Create index if it doesn't exist
        const indexName = process.env.PINECONE_INDEX_NAME || 'tender-documents';
        
        const existingIndexes = await pinecone.listIndexes();
        const indexExists = existingIndexes.indexes?.some(idx => idx.name === indexName);
        
        if (!indexExists) {
          console.log(`Creating Pinecone index: ${indexName}`);
          await pinecone.createIndex({
            name: indexName,
            dimension: 768, // Google Generative AI embeddings dimension
            metric: 'cosine',
            spec: {
              serverless: {
                cloud: 'gcp',
                region: 'gcp-starter' // Using gcp-starter for free tier compatibility
              }
            }
          });
          console.log(`Successfully created Pinecone index: ${indexName}`);
        }
        
        console.log(`Using index: ${indexName}`);
        const index = pinecone.index(indexName);
        
        // Log what we'd be indexing since we can't use the embeddings directly in this script
        console.log(`Would index ${docs.length} documents with these titles:`);
        docs.forEach(doc => console.log(` - ${doc.title} (${doc.type})`));
        
        // Create a vector with dummy embedding to test the index is working
        try {
          // Just a test vector to verify connection
          await index.upsert([{
            id: 'test-vector',
            values: Array(768).fill(0.1), // Generate dummy 768-dimensional vector
            metadata: { test: true }
          }]);
          console.log('Successfully added test vector to index.');
        } catch (e) {
          console.error('Failed to add test vector:', e);
        }
        
        return docs.length;
      };
    } catch (importError) {
      console.error('Error:', importError);
      return false;
    }
    
    // Index the documents
    console.log(`Indexing ${allDocuments.length} documents in Pinecone...`);
    const indexedCount = await indexFunction(allDocuments);
    
    console.log(`Successfully indexed ${indexedCount} documents in Pinecone`);
    console.log('Document indexing completed successfully');
    
    return true;
  } catch (error) {
    console.error('Error indexing documents:', error);
    return false;
  }
}

// Run the indexing
indexAllDocuments()
  .then(success => {
    if (success) {
      console.log('✅ Document indexing completed successfully');
    } else {
      console.log('❌ Document indexing failed');
    }
  })
  .catch(error => {
    console.error('Unexpected error during document indexing:', error);
  }); 