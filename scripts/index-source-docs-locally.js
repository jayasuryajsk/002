// Script to index source documents locally (without Pinecone)
require('dotenv').config();
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
const sourceFolder = args[0] || './source-docs-to-index';
const verbose = args.includes('--verbose');

// Configure logging
const log = {
  info: (message) => console.log(`INFO: ${message}`),
  debug: (message) => verbose && console.log(`DEBUG: ${message}`),
  error: (message, error) => console.error(`ERROR: ${message}`, error || '')
};

// Process documents from the directory
async function processDocumentsFromDirectory(folderPath) {
  try {
    log.info(`Loading source documents from ${folderPath}...`);
    
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
    
    // Create the local storage directory for source docs
    const sourceDocsDir = path.join(process.cwd(), 'local-storage', 'source-docs');
    if (!fs.existsSync(sourceDocsDir)) {
      fs.mkdirSync(sourceDocsDir, { recursive: true });
    }
    
    // Create metadata and save documents
    const processedFiles = new Set();
    
    // Group documents by source file
    const docsBySource = {};
    rawDocs.forEach(doc => {
      const source = doc.metadata.source;
      if (!docsBySource[source]) {
        docsBySource[source] = [];
      }
      docsBySource[source].push(doc);
    });
    
    // Process each source file
    Object.keys(docsBySource).forEach(source => {
      try {
        const sourceId = uuidv4();
        const fileBaseName = path.basename(source);
        
        // Create aggregated content from all parts of the document
        const fullContent = docsBySource[source]
          .map(doc => doc.pageContent)
          .join('\n\n');
        
        // Save the content
        const contentPath = path.join(sourceDocsDir, `${sourceId}-content`);
        fs.writeFileSync(contentPath, fullContent, 'utf8');
        
        // Create metadata
        const metadata = {
          id: sourceId,
          title: path.basename(source, path.extname(source)),
          type: 'source',
          metadata: {
            dateAdded: new Date().toISOString(),
            fileType: path.extname(source).substring(1).toLowerCase(),
            fileSize: fs.statSync(source).size,
            source: 'source-docs',
            originalPath: source
          }
        };
        
        // Save metadata
        const metadataPath = path.join(sourceDocsDir, `${sourceId}-metadata.json`);
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
        
        log.info(`Saved source document: ${fileBaseName}`);
        
        // Move the file to processed folder
        const processedPath = path.join(processedDir, fileBaseName);
        fs.copyFileSync(source, processedPath);
        fs.unlinkSync(source);
        log.info(`Moved to processed folder: ${fileBaseName}`);
        
        // Track processed files
        processedFiles.add(source);
      } catch (err) {
        log.error(`Error processing document ${source}:`, err);
      }
    });
    
    // Create a combined index file for all source documents
    createSourceDocsIndex(sourceDocsDir);
    
    return Array.from(processedFiles);
  } catch (error) {
    log.error('Error processing documents from directory:', error);
    throw error;
  }
}

// Create a combined index of all source documents for easy access
function createSourceDocsIndex(sourceDocsDir) {
  try {
    const files = fs.readdirSync(sourceDocsDir);
    const metadataFiles = files.filter(file => file.endsWith('-metadata.json'));
    
    const sourceDocuments = [];
    for (const file of metadataFiles) {
      const metadataPath = path.join(sourceDocsDir, file);
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      const contentPath = path.join(sourceDocsDir, `${metadata.id}-content`);
      if (fs.existsSync(contentPath)) {
        const contentPreview = fs.readFileSync(contentPath, 'utf8').substring(0, 200) + '...';
        
        sourceDocuments.push({
          id: metadata.id,
          title: metadata.title,
          type: metadata.type,
          preview: contentPreview,
          metadata: metadata.metadata
        });
      }
    }
    
    // Write the index file
    const indexPath = path.join(sourceDocsDir, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(sourceDocuments, null, 2), 'utf8');
    
    log.info(`Created source documents index with ${sourceDocuments.length} documents`);
    return sourceDocuments.length;
  } catch (error) {
    log.error('Error creating source documents index:', error);
    return 0;
  }
}

// Main function
async function main() {
  try {
    // Show help if requested
    if (args.includes('--help')) {
      console.log(`
Source Document Local Indexing Script

Usage:
  node index-source-docs-locally.js [folder_path] [options]

Arguments:
  folder_path         Path to folder containing source documents (default: ./source-docs-to-index)
                      Supports: PDF, DOCX, TXT, CSV, JSON files

Options:
  --help              Show this help message
  --verbose           Show more detailed logs

Description:
  This script indexes source documents LOCALLY ONLY (not in Pinecone).
  These documents will be used by the main agent to understand the tender task
  before planning and delegating to subagents.

Examples:
  node index-source-docs-locally.js ./my-source-docs
  node index-source-docs-locally.js --verbose
      `);
      return;
    }
    
    // Create source folder if it doesn't exist
    if (!fs.existsSync(sourceFolder)) {
      log.info(`Creating source folder: ${sourceFolder}`);
      fs.mkdirSync(sourceFolder, { recursive: true });
      log.info(`Place your source documents (PDFs, DOCs, etc.) in ${sourceFolder} and run this script again`);
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
    const processedFiles = await processDocumentsFromDirectory(sourceFolder);
    
    if (!processedFiles || processedFiles.length === 0) {
      log.info(`No valid document content found in ${sourceFolder}`);
      return;
    }
    
    log.info(`Successfully indexed ${processedFiles.length} source documents locally`);
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
      console.log('✅ Source document indexing completed successfully');
      console.log('Source documents are now available for main agent use');
    } else {
      console.log('❓ Source document indexing completed with some issues');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Unexpected error during execution:', error);
    process.exit(1);
  }); 