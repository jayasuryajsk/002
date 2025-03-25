import { NextRequest, NextResponse } from 'next/server'
import { SourceDocument } from '@/lib/agents/types'
import { LocalDocumentStorage } from '@/lib/local-storage'
import fs from 'fs'
import path from 'path'
import { storeDocumentsInPinecone, ensurePineconeIndex, clearPineconeDocuments } from '@/lib/document-indexing/pinecone'

// In-memory storage for documents
let sourceDocuments: SourceDocument[] = [];
let documentsLoaded = false;
let documentsIndexed = false;

// Load documents from persistent storage
async function loadDocumentsFromStorage() {
  try {
    console.log('Index API: Loading documents from local storage...');
    sourceDocuments = await LocalDocumentStorage.getSourceDocuments();
    console.log(`Loaded ${sourceDocuments.length} source documents from local storage`);
    documentsLoaded = true;
    
    if (sourceDocuments.length === 0) {
      console.warn("WARNING: No source documents were found in local storage!");
      
      // Check local-storage directory directly
      const localStorageDir = path.join(process.cwd(), 'local-storage', 'source-docs');
      console.log(`Checking directory: ${localStorageDir}`);
      
      if (fs.existsSync(localStorageDir)) {
        const files = fs.readdirSync(localStorageDir);
        console.log(`Files in directory: ${files.join(', ')}`);
        
        const metadataFiles = files.filter(file => file.endsWith('-metadata.json'));
        console.log(`Found ${metadataFiles.length} metadata files in local-storage directory`);
        
        if (metadataFiles.length > 0) {
          sourceDocuments = metadataFiles.map(file => {
            try {
              const metadataPath = path.join(localStorageDir, file);
              const metadataContent = fs.readFileSync(metadataPath, 'utf8');
              const metadata = JSON.parse(metadataContent);
              
              const contentPath = path.join(localStorageDir, `${metadata.id}-content`);
              let content = '';
              
              if (fs.existsSync(contentPath)) {
                if (metadata.type === 'pdf' || (metadata.metadata?.fileType && metadata.metadata.fileType.includes('pdf'))) {
                  console.log(`Found PDF document: ${metadata.title}`);
                  // Just note that it's a PDF, we'll load the binary later when needed
                  content = 'PDF document - binary content';
                } else {
                  content = fs.readFileSync(contentPath, 'utf8');
                }
              } else {
                console.warn(`Content file not found for document: ${metadata.id}`);
              }
              
              console.log(`Loaded document: ${metadata.title}, type: ${metadata.type}`);
              
              const doc: SourceDocument = {
                id: metadata.id,
                title: metadata.title,
                type: metadata.type,
                content: content,
                metadata: metadata.metadata || {}
              };
              
              return doc;
            } catch (error) {
              console.error(`Error processing metadata file ${file}:`, error);
              return null;
            }
          }).filter((doc): doc is SourceDocument => doc !== null);
          
          console.log(`Created ${sourceDocuments.length} documents from local-storage directory`);
        }
      } else {
        console.error(`Local storage directory does not exist: ${localStorageDir}`);
        // Create the directory structure
        console.log('Creating local storage directories...');
        fs.mkdirSync(path.join(process.cwd(), 'local-storage'), { recursive: true });
        fs.mkdirSync(path.join(process.cwd(), 'local-storage', 'source-docs'), { recursive: true });
      }
    }
    
    if (sourceDocuments.length > 0) {
      console.log("Source document IDs:", sourceDocuments.map(doc => doc.id).join(', '));
      console.log("Source document titles:", sourceDocuments.map(doc => doc.title).join(', '));
      console.log("Source document types:", sourceDocuments.map(doc => doc.type).join(', '));
    }
  } catch (error) {
    console.error('Error loading documents from storage:', error);
  }
}

// Index all documents in Pinecone
async function indexAllDocuments() {
  try {
    console.log('Starting document indexing process...');
    
    // First ensure Pinecone index exists
    await ensurePineconeIndex();
    
    if (sourceDocuments.length === 0) {
      return {
        success: false,
        message: 'No documents to index',
        error: 'No documents found in storage'
      };
    }
    
    // Store documents in Pinecone
    const totalChunks = await storeDocumentsInPinecone(sourceDocuments);
    documentsIndexed = true;
    
    return {
      success: true,
      message: `Successfully indexed ${sourceDocuments.length} documents with ${totalChunks} total chunks`,
      documentCount: sourceDocuments.length,
      chunkCount: totalChunks
    };
  } catch (error) {
    console.error('Error indexing documents:', error);
    return {
      success: false,
      message: 'Failed to index documents',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Define both GET and POST handlers
export async function GET() {
  console.log('Index API: GET request received');
  return NextResponse.json({ 
    message: "Document indexing API is working. Use POST to index documents." 
  });
}

export async function POST(request: NextRequest) {
  console.log('Index API: POST request received');
  
  try {
    // Parse request body
    const body = await request.json();
    const { action = 'index', refresh = false } = body;
    
    // Simple response for testing
    return NextResponse.json({
      success: true,
      message: "This is a test response from the index API",
      receivedAction: action,
      receivedRefresh: refresh
    });
  } catch (error) {
    console.error('Error in Index API:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 