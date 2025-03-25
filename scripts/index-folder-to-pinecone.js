// Script to automatically index all documents in a folder to Pinecone
require('dotenv').config();
const { PineconeStore } = require('@langchain/pinecone');
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { DirectoryLoader } = require("langchain/document_loaders/fs/directory");
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const { DocxLoader } = require("langchain/document_loaders/fs/docx");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { CSVLoader } = require("langchain/document_loaders/fs/csv");
const { JSONLoader } = require("langchain/document_loaders/fs/json");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Command line arguments
const args = process.argv.slice(2);
const sourceFolder = args[0] || './docs-to-index';
const verbose = args.includes('--verbose');
const forceReindex = args.includes('--force');

// Configure logging
const log = {
  info: (message) => console.log(`INFO: ${message}`),
  debug: (message) => verbose && console.log(`DEBUG: ${message}`),
  error: (message, error) => console.error(`ERROR: ${message}`, error || '')
};

// Initialize embeddings with Google AI
async function initializeEmbeddings() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    log.error('GOOGLE_GENERATIVE_AI_API_KEY environment variable not set');
    return null;
  }
  
  return new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
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

// Process documents from the directory
async function processDocumentsFromDirectory(folderPath) {
  try {
    log.info(`Loading documents from ${folderPath}...`);
    
    // Create the processed directory
    const processedDir = path.join(folderPath, '_processed');
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
    }
    
    // Set up directory loader with appropriate loaders for each file type
    const loader = new DirectoryLoader(folderPath, {
      ".pdf": (path) => new PDFLoader(path),
      ".docx": (path) => new DocxLoader(path),
      ".doc": (path) => new DocxLoader(path),
      ".txt": (path) => new TextLoader(path),
      ".csv": (path) => new CSVLoader(path),
      ".json": (path) => new JSONLoader(path, "/texts"),
    }, {
      // Skip hidden files and directories
      hidden: false,
      // Skip the _processed directory
      exclude: [processedDir]
    });
    
    // Load all documents
    const rawDocs = await loader.load();
    log.info(`Loaded ${rawDocs.length} documents`);
    
    // Skip if no documents were loaded
    if (rawDocs.length === 0) {
      log.info(`No documents found in ${folderPath}`);
      return [];
    }
    
    // Split documents into smaller chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    const docs = await textSplitter.splitDocuments(rawDocs);
    log.info(`Split into ${docs.length} chunks`);
    
    // Create the local storage directory
    const companyDocsDir = path.join(process.cwd(), 'local-storage', 'company-docs');
    if (!fs.existsSync(companyDocsDir)) {
      fs.mkdirSync(companyDocsDir, { recursive: true });
    }
    
    // Store documents in local storage
    const processedFiles = new Set();
    const enhancedDocs = docs.map(doc => {
      // Generate a unique ID for each chunk
      const id = uuidv4();
      
      // Get original source path
      const sourcePath = doc.metadata.source;
      const fileBaseName = path.basename(sourcePath);
      
      // Track which files we've processed
      processedFiles.add(sourcePath);
      
      return {
        ...doc,
        metadata: {
          ...doc.metadata,
          id,
          title: path.basename(sourcePath, path.extname(sourcePath)),
          type: 'company',
          chunk: 0, // Will be updated later
          source: 'company-docs',
          dateAdded: new Date().toISOString(),
        }
      };
    });
    
    // Group documents by source file for better organization and tracking
    const docsBySource = {};
    enhancedDocs.forEach(doc => {
      const source = doc.metadata.source;
      if (!docsBySource[source]) {
        docsBySource[source] = [];
      }
      docsBySource[source].push(doc);
    });
    
    // Update chunk indices
    Object.keys(docsBySource).forEach(source => {
      const chunksForSource = docsBySource[source];
      chunksForSource.forEach((doc, idx) => {
        doc.metadata.chunk = idx;
        doc.metadata.chunkTotal = chunksForSource.length;
      });
    });
    
    // Save metadata for each document
    Object.keys(docsBySource).forEach(source => {
      try {
        const sourceId = uuidv4();
        const fileBaseName = path.basename(source);
        const metadataPath = path.join(companyDocsDir, `${sourceId}-metadata.json`);
        
        // Create aggregated content from all chunks
        const fullContent = docsBySource[source]
          .map(doc => doc.pageContent)
          .join('\n\n');
        
        // Save the content
        const contentPath = path.join(companyDocsDir, `${sourceId}-content`);
        fs.writeFileSync(contentPath, fullContent, 'utf8');
        
        // Save the metadata
        const metadata = {
          id: sourceId,
          title: path.basename(source, path.extname(source)),
          type: 'company',
          metadata: {
            dateAdded: new Date().toISOString(),
            fileType: path.extname(source).substring(1).toLowerCase(),
            fileSize: fs.statSync(source).size,
            source: 'company-docs',
            originalPath: source,
            chunkCount: docsBySource[source].length
          }
        };
        
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
        log.info(`Saved document metadata for: ${fileBaseName}`);
        
        // Move the file to processed folder
        const processedPath = path.join(processedDir, fileBaseName);
        fs.copyFileSync(source, processedPath);
        fs.unlinkSync(source);
        log.info(`Moved to processed folder: ${fileBaseName}`);
      } catch (err) {
        log.error(`Error processing document ${source}:`, err);
      }
    });
    
    return enhancedDocs;
  } catch (error) {
    log.error('Error processing documents from directory:', error);
    throw error;
  }
}

// Store documents in Pinecone
async function storeDocumentsInPinecone(docs, pinecone, embeddings) {
  try {
    log.info(`Starting to store ${docs.length} document chunks in Pinecone...`);
    
    // Get the index
    const indexName = process.env.PINECONE_INDEX_NAME || 'tender-documents';
    const index = pinecone.index(indexName);
    
    // Store documents in Pinecone using LangChain
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      maxConcurrency: 5, // Adjust based on your Pinecone plan
      textKey: 'pageContent', // This is the default key
    });
    
    log.info(`Successfully stored ${docs.length} document chunks in Pinecone`);
    return docs.length;
  } catch (error) {
    log.error('Failed to store documents in Pinecone:', error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    // Show help if requested
    if (args.includes('--help')) {
      console.log(`
Document Folder Indexing Script

Usage:
  node index-folder-to-pinecone.js [folder_path] [options]

Arguments:
  folder_path         Path to folder containing documents (default: ./docs-to-index)
                      Supports: PDF, DOCX, TXT, CSV, JSON files

Options:
  --help              Show this help message
  --force             Force reindexing of all documents
  --verbose           Show more detailed logs

Examples:
  node index-folder-to-pinecone.js ./my-company-docs
  node index-folder-to-pinecone.js --verbose
      `);
      return;
    }
    
    // Create source folder if it doesn't exist
    if (!fs.existsSync(sourceFolder)) {
      log.info(`Creating source folder: ${sourceFolder}`);
      fs.mkdirSync(sourceFolder, { recursive: true });
      log.info(`Place your documents (PDFs, DOCs, etc.) in ${sourceFolder} and run this script again`);
      return;
    }
    
    // Check if there are any files in the folder
    const files = fs.readdirSync(sourceFolder);
    const documentFiles = files.filter(file => {
      const filePath = path.join(sourceFolder, file);
      const isDir = fs.statSync(filePath).isDirectory();
      const isHidden = file.startsWith('.');
      const isProcessed = file === '_processed';
      return !isDir && !isHidden && !isProcessed;
    });
    
    if (documentFiles.length === 0) {
      log.info(`No documents found in ${sourceFolder}. Please add some documents and run again.`);
      return;
    }
    
    // Process documents from the directory
    const docs = await processDocumentsFromDirectory(sourceFolder);
    
    if (!docs || docs.length === 0) {
      log.info(`No valid document content found in ${sourceFolder}`);
      return;
    }
    
    // Initialize embedding model
    const embeddings = await initializeEmbeddings();
    if (!embeddings) {
      log.error('Failed to initialize embeddings');
      return;
    }
    
    // Initialize Pinecone
    if (!process.env.PINECONE_API_KEY) {
      log.error('PINECONE_API_KEY environment variable not set');
      return;
    }
    
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    
    // Ensure index exists
    const indexName = await ensurePineconeIndex(pinecone);
    if (!indexName) {
      log.error('Failed to ensure Pinecone index exists');
      return;
    }
    
    // Store documents in Pinecone
    const indexedCount = await storeDocumentsInPinecone(docs, pinecone, embeddings);
    log.info(`Successfully indexed ${indexedCount} document chunks in Pinecone`);
    
    log.info('Document indexing completed successfully');
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
      console.log('✅ Document indexing completed successfully');
    } else {
      console.log('❓ Document indexing completed with some issues');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Unexpected error during execution:', error);
    process.exit(1);
  }); 