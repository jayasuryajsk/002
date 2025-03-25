// Script to index company documents into Pinecone
require('dotenv').config();
const { PineconeStore } = require('@langchain/pinecone');
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Command line arguments
const args = process.argv.slice(2);
const forceRefresh = args.includes('--force');
const skipEmbeddings = args.includes('--skip-embeddings');
const skipPinecone = args.includes('--skip-pinecone');
const verbose = args.includes('--verbose');

// Configure logging
const log = {
  info: (message) => console.log(`INFO: ${message}`),
  debug: (message) => verbose && console.log(`DEBUG: ${message}`),
  error: (message, error) => console.error(`ERROR: ${message}`, error || '')
};

// Function to chunk text (same as in processor.ts)
function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  
  // Try to split on semantic boundaries like paragraphs first
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the chunk size, save current chunk and start a new one
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      // Include overlap from previous chunk
      currentChunk = currentChunk.slice(-overlap) + paragraph;
    } else {
      // Otherwise, add paragraph to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
    
    // If current chunk is now bigger than chunk size, split it further
    while (currentChunk.length > chunkSize) {
      // Find a good splitting point - preferably at a sentence boundary
      let splitPoint = currentChunk.lastIndexOf('. ', chunkSize);
      if (splitPoint === -1 || splitPoint < chunkSize / 2) {
        // If no good sentence boundary, split at a space
        splitPoint = currentChunk.lastIndexOf(' ', chunkSize);
      }
      if (splitPoint === -1 || splitPoint < chunkSize / 2) {
        // Just split at chunk size
        splitPoint = chunkSize;
      } else {
        // Include the period and space if we split at a sentence
        splitPoint += 2;
      }
      
      chunks.push(currentChunk.slice(0, splitPoint));
      currentChunk = currentChunk.slice(Math.max(0, splitPoint - overlap));
    }
  }
  
  // Add the last chunk if it's not empty
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Function to read document content from file
function readDocument(id, dirPath) {
  const metadataPath = path.join(dirPath, `${id}-metadata.json`);
  const contentPath = path.join(dirPath, `${id}-content`);
  
  try {
    if (!fs.existsSync(metadataPath)) {
      log.error(`Metadata file not found for ${id}`);
      return null;
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    let content = '';
    if (fs.existsSync(contentPath)) {
      content = fs.readFileSync(contentPath, 'utf8');
    } else {
      log.error(`Content file not found for ${id}`);
      return null;
    }
    
    return {
      id: metadata.id,
      title: metadata.title || 'Untitled Document',
      type: metadata.type || 'company',
      content: content,
      metadata: {
        ...metadata.metadata || {},
        source: 'company-docs',
        dateIndexed: new Date().toISOString()
      }
    };
  } catch (error) {
    log.error(`Error reading document ${id}:`, error);
    return null;
  }
}

// Function to fetch all company documents from local storage
async function getCompanyDocuments() {
  try {
    const companyDocsDir = path.join(process.cwd(), 'local-storage', 'company-docs');
    const companyDocuments = [];
    
    // Ensure directory exists
    if (!fs.existsSync(companyDocsDir)) {
      log.info(`Creating company docs directory: ${companyDocsDir}`);
      fs.mkdirSync(companyDocsDir, { recursive: true });
      return companyDocuments;
    }
    
    // Get company documents
    const files = fs.readdirSync(companyDocsDir);
    const metadataFiles = files.filter(file => file.endsWith('-metadata.json'));
    
    for (const file of metadataFiles) {
      const id = file.replace('-metadata.json', '');
      const doc = readDocument(id, companyDocsDir);
      if (doc) {
        companyDocuments.push(doc);
      }
    }
    
    log.info(`Found ${companyDocuments.length} company documents`);
    return companyDocuments;
  } catch (error) {
    log.error('Error getting company documents:', error);
    return [];
  }
}

// Initialize embeddings with Google AI
async function initializeEmbeddings() {
  if (!process.env.GOOGLE_API_KEY) {
    log.error('GOOGLE_API_KEY environment variable not set');
    return null;
  }
  
  return new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    modelName: 'embedding-001',
  });
}

// Ensure Pinecone index exists
async function ensurePineconeIndex(pinecone) {
  try {
    const indexName = process.env.PINECONE_INDEX_NAME || 'tender-documents';
    
    // List existing indexes
    const existingIndexes = await pinecone.listIndexes();
    
    // Check if our index exists
    const indexExists = existingIndexes.indexes?.some(idx => idx.name === indexName);
    
    if (!indexExists) {
      log.info(`Creating Pinecone index: ${indexName}`);
      // Create the index with dimensions matching the Google embedding model (768 for embedding-001)
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
      log.info(`Successfully created Pinecone index: ${indexName}`);
    } else {
      log.info(`Pinecone index ${indexName} already exists`);
    }
    
    return indexName;
  } catch (error) {
    log.error('Error ensuring Pinecone index exists:', error);
    return null;
  }
}

// Store documents in Pinecone
async function storeDocumentsInPinecone(documents, pinecone, embeddings) {
  try {
    log.info(`Starting to store ${documents.length} documents in Pinecone...`);
    
    // Get the index
    const indexName = process.env.PINECONE_INDEX_NAME || 'tender-documents';
    const index = pinecone.index(indexName);
    
    let totalChunks = 0;
    
    for (const doc of documents) {
      // Skip if no meaningful content
      if (!doc.content || doc.content.length < 10) {
        log.warn(`Document ${doc.title} has insufficient content for indexing`);
        continue;
      }
      
      // Split the document into chunks
      const textChunks = chunkText(doc.content);
      log.debug(`Split document ${doc.title} into ${textChunks.length} chunks`);
      
      // Create metadata for each chunk
      const metadatas = textChunks.map((_chunk, i) => ({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        chunk: i,
        chunkTotal: textChunks.length,
        source: 'company-docs',
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
        
        log.info(`Stored batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(textChunks.length / batchSize)} for document ${doc.title}`);
      }
      
      totalChunks += textChunks.length;
    }
    
    log.info(`Successfully stored ${totalChunks} chunks from ${documents.length} documents in Pinecone`);
    return totalChunks;
  } catch (error) {
    log.error('Failed to store documents in Pinecone:', error);
    throw error;
  }
}

// Add a new company document to local storage
async function addCompanyDocument(filePath, title) {
  try {
    const companyDocsDir = path.join(process.cwd(), 'local-storage', 'company-docs');
    
    // Ensure directory exists
    if (!fs.existsSync(companyDocsDir)) {
      fs.mkdirSync(companyDocsDir, { recursive: true });
    }
    
    // Generate document ID
    const id = uuidv4();
    
    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Create metadata
    const metadata = {
      id,
      title: title || path.basename(filePath),
      type: 'company',
      metadata: {
        dateAdded: new Date().toISOString(),
        fileType: path.extname(filePath).substring(1),
        fileSize: fs.statSync(filePath).size,
        path: filePath,
        source: 'company-docs'
      }
    };
    
    // Save metadata and content
    const metadataPath = path.join(companyDocsDir, `${id}-metadata.json`);
    const contentPath = path.join(companyDocsDir, `${id}-content`);
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    fs.writeFileSync(contentPath, content, 'utf8');
    
    log.info(`Added document "${metadata.title}" with ID ${id}`);
    
    return {
      id,
      title: metadata.title,
      type: 'company',
      content,
      metadata: metadata.metadata
    };
  } catch (error) {
    log.error('Error adding company document:', error);
    return null;
  }
}

// Main function
async function main() {
  // Check parameters
  if (args.includes('--help')) {
    console.log(`
Company Document Indexing Script

Usage:
  node index-company-docs.js [options] [file] [title]

Options:
  --help              Show this help message
  --force             Force reindexing all documents
  --skip-embeddings   Skip embedding generation (for testing)
  --skip-pinecone     Skip Pinecone storage (for testing)
  --verbose           Show more detailed logs

Arguments:
  file                Path to a file to add as a company document
  title               Title for the document being added
    `);
    return;
  }

  // Get file and title arguments
  const fileArg = args.find(arg => !arg.startsWith('--'));
  const titleIndex = args.indexOf(fileArg) + 1;
  const titleArg = titleIndex < args.length && !args[titleIndex].startsWith('--') ? args[titleIndex] : null;

  try {
    // Add document if file is provided
    if (fileArg && fs.existsSync(fileArg)) {
      const addedDoc = await addCompanyDocument(fileArg, titleArg);
      if (!addedDoc) {
        log.error('Failed to add document');
        return;
      }
      log.info(`Successfully added document: ${addedDoc.title}`);
    }
    
    // Get company documents
    const companyDocuments = await getCompanyDocuments();
    
    if (companyDocuments.length === 0) {
      log.info('No company documents found to index');
      return;
    }
    
    // Initialize embeddings if not skipping
    let embeddings = null;
    if (!skipEmbeddings) {
      embeddings = await initializeEmbeddings();
      if (!embeddings) {
        log.error('Failed to initialize embeddings');
        if (!skipPinecone) return;
      }
    } else {
      log.info('Skipping embeddings generation');
    }
    
    // Initialize Pinecone if not skipping
    let pinecone = null;
    if (!skipPinecone) {
      if (!process.env.PINECONE_API_KEY) {
        log.error('PINECONE_API_KEY environment variable not set');
        return;
      }
      
      pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });
      
      const indexName = await ensurePineconeIndex(pinecone);
      if (!indexName) {
        log.error('Failed to ensure Pinecone index exists');
        return;
      }
    } else {
      log.info('Skipping Pinecone operations');
    }
    
    // Store documents in Pinecone if not skipping
    if (!skipPinecone && !skipEmbeddings) {
      const indexedCount = await storeDocumentsInPinecone(companyDocuments, pinecone, embeddings);
      log.info(`Successfully indexed ${indexedCount} chunks from ${companyDocuments.length} documents in Pinecone`);
    } else if (!skipPinecone) {
      log.error('Cannot store in Pinecone without embeddings');
    }
    
    log.info('Company document indexing completed successfully');
    return true;
  } catch (error) {
    log.error('Error in main process:', error);
    return false;
  }
}

// Run the script
main()
  .then(success => {
    if (success) {
      console.log('✅ Company document indexing completed successfully');
    } else {
      console.log('❌ Company document indexing completed with errors');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error during execution:', error);
    process.exit(1);
  }); 