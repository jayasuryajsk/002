import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { 
  processFile, 
  processDocument 
} from "../../../../lib/document-indexing/processor";
import { 
  supabase, 
  setupVectorStore, 
  createStoredProcedures 
} from "../../../../lib/document-indexing/supabase";
import { LocalDocumentStorage } from "../../../../lib/local-storage";
import * as fs from 'fs';
import * as path from 'path';

// Ensure temp directory exists
const TEMP_DIR = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// File size limit (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Supported file types
const SUPPORTED_FILE_TYPES = ['pdf', 'docx', 'txt'];

export async function POST(req: Request) {
  // Track the created temp file path to ensure cleanup
  let tempFilePath: string | null = null;
  
  try {
    // Set up vector store if it doesn't exist
    await createStoredProcedures();
    await setupVectorStore();
    
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const docType = formData.get("docType") as string || "source";
    
    // Validate document type
    if (docType !== 'source' && docType !== 'company') {
      return NextResponse.json({ 
        error: "Invalid document type. Must be 'source' or 'company'." 
      }, { status: 400 });
    }
    
    // Check if file exists
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: "File too large. Maximum size is 10MB." 
      }, { status: 400 });
    }
    
    // Validate file type
    const fileName = file.name;
    const fileSize = file.size;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    
    if (!SUPPORTED_FILE_TYPES.includes(fileExtension)) {
      return NextResponse.json({ 
        error: `Unsupported file type: ${fileExtension}. Supported formats: PDF, DOCX, TXT.` 
      }, { status: 400 });
    }
    
    // Create a temporary file path
    const fileId = uuidv4();
    tempFilePath = path.join(TEMP_DIR, `${fileId}.${fileExtension}`);
    
    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    fs.writeFileSync(tempFilePath, buffer);
    
    try {
      // Process file into a document object
      const documentObj = await processFile(
        tempFilePath, 
        fileName, 
        fileId, 
        fileExtension, 
        fileSize,
        docType
      );
      
      // Store in local storage
      if (docType === "company") {
        await LocalDocumentStorage.storeCompanyDocument(documentObj);
      } else {
        await LocalDocumentStorage.storeSourceDocument(documentObj);
      }
      
      // Process document and get chunks with embeddings
      const { chunks, metadata } = await processDocument(documentObj);
      
      if (chunks.length === 0) {
        throw new Error("No text could be extracted from the document");
      }
      
      // Store chunks in Supabase
      const insertPromises = chunks.map(async (chunk, index) => {
        const { content: chunkContent, embedding } = chunk;
        
        if (!embedding || embedding.length === 0) {
          throw new Error("Failed to generate embeddings for chunk");
        }
        
        return supabase.from('documents').insert({
          id: `${fileId}_chunk_${index}`,
          content: chunkContent,
          metadata: {
            ...metadata,
            parent_id: fileId,
            chunk_index: index,
            chunk_count: chunks.length
          },
          embedding
        });
      });
      
      // Wait for all chunks to be inserted
      const results = await Promise.all(insertPromises);
      
      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        console.error('Errors inserting chunks:', errors);
        return NextResponse.json({ 
          error: "Some chunks failed to be indexed",
          details: errors.map(e => e.error)
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        success: true, 
        fileId,
        fileName,
        message: "Document indexed successfully",
        chunkCount: chunks.length,
        docType: docType
      });
    } finally {
      // Clean up temp file regardless of success or error
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.error("Error deleting temporary file:", cleanupError);
        }
      }
    }
  } catch (error) {
    console.error("Document indexing error:", error);
    
    // Clean up temp file in case of error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.error("Error deleting temporary file:", cleanupError);
      }
    }
    
    return NextResponse.json({ 
      error: "Failed to index document",
      details: (error as Error).message || "Unknown error occurred"
    }, { status: 500 });
  }
} 