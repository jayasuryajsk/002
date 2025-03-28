import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { SourceDocument, CompanyDocument } from "../agents/types";
// @ts-ignore
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as fs from 'fs';

// Improved text chunking with better overlap handling and semantic boundaries
export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  if (!text || text.trim() === '') {
    throw new Error("Cannot chunk empty text");
  }
  
  const chunks: string[] = [];
  
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
        // If still no good split, just split at chunk size
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
  
  if (chunks.length === 0) {
    throw new Error("Text chunking resulted in 0 chunks");
  }
  
  return chunks;
}

// Generate embeddings using Google AI SDK
export async function generateEmbeddings(text: string): Promise<number[]> {
  if (!text || text.trim() === '') {
    throw new Error("Cannot generate embeddings for empty text");
  }
  
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
  }
  
  try {
    // Note: Currently the Vercel AI SDK doesn't directly support embedding generation
    // This is a placeholder for when that functionality is available
    // For now, we'll need to use the langchain integration or another approach
    
    // This is a placeholder - in production we would use the proper integration
    // Return a random vector of the right dimension for now
    console.warn("Using placeholder embedding generation - implement proper integration");
    return new Array(768).fill(0).map(() => Math.random() * 2 - 1);
  } catch (error) {
    console.error("Error generating embeddings:", error);
    if ((error as Error).message.includes('API key')) {
      throw new Error("Invalid or missing API key for embedding generation");
    }
    throw new Error(`Embedding generation failed: ${(error as Error).message}`);
  }
}

// Extract text and metadata from a file based on its type
export async function extractTextFromFile(filePath: string, fileType: string): Promise<{
  text: string;
  metadata: Record<string, any>;
}> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  try {
    let text = '';
    let metadata: Record<string, any> = {};
    
    // For PDF files
    if (fileType === 'pdf') {
      try {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        text = pdfData.text;
        
        // Extract PDF metadata
        metadata = {
          pageCount: pdfData.numpages,
          author: pdfData.info?.Author || '',
          title: pdfData.info?.Title || '',
          subject: pdfData.info?.Subject || '',
          keywords: pdfData.info?.Keywords || '',
          creator: pdfData.info?.Creator || '',
          producer: pdfData.info?.Producer || '',
          creationDate: pdfData.info?.CreationDate || '',
        };
        
        if (!text || text.trim() === '') {
          throw new Error("PDF parsing resulted in empty text. The PDF might be scanned or contain only images.");
        }
      } catch (pdfError) {
        throw new Error(`PDF parsing error: ${(pdfError as Error).message}`);
      }
    }
    
    // For Word documents
    else if (fileType === 'docx' || fileType === 'doc') {
      try {
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value;
        
        if (!text || text.trim() === '') {
          throw new Error("DOCX parsing resulted in empty text. The document might be corrupted or contain only images.");
        }
        
        // Extract DOCX metadata if available
        try {
          const stats = fs.statSync(filePath);
          metadata = {
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
          };
        } catch (metadataError) {
          console.warn('Could not extract DOCX metadata:', metadataError);
          // Continue even if metadata extraction fails
        }
      } catch (docxError) {
        throw new Error(`DOCX parsing error: ${(docxError as Error).message}`);
      }
    }
    
    // For text files
    else if (fileType === 'txt') {
      try {
        text = fs.readFileSync(filePath, 'utf8');
        
        if (!text || text.trim() === '') {
          throw new Error("The text file is empty or contains only whitespace.");
        }
        
        // Basic metadata for text files
        const stats = fs.statSync(filePath);
        metadata = {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
        };
      } catch (txtError) {
        throw new Error(`Text file parsing error: ${(txtError as Error).message}`);
      }
    }
    
    else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
    
    return { text, metadata };
  } catch (error) {
    console.error(`Error extracting text from ${fileType} file:`, error);
    throw error;
  }
}

// Extract key information from document content
export async function extractDocumentInfo(text: string): Promise<{
  summary: string;
  keyTopics: string[];
  documentType: string;
}> {
  if (!text || text.trim() === '') {
    return {
      summary: 'No content to summarize',
      keyTopics: [],
      documentType: 'unknown'
    };
  }
  
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (!apiKey) {
    console.warn("GOOGLE_GENERATIVE_AI_API_KEY is not set, skipping document info extraction");
    return {
      summary: '',
      keyTopics: [],
      documentType: 'unknown'
    };
  }
  
  try {
    // Create Google AI provider
    const googleAI = createGoogleGenerativeAI({
      apiKey: apiKey
    });
    
    const prompt = `
      Analyze the following document text and extract:
      1. A brief summary (max 200 words)
      2. Key topics or themes (list of 5-10 keywords or short phrases)
      3. Document type classification (e.g., RFP, technical specification, company profile, etc.)
      
      Format your response as JSON with the following structure:
      {
        "summary": "...",
        "keyTopics": ["topic1", "topic2", ...],
        "documentType": "..."
      }
      
      Document text:
      ${text.slice(0, 10000)} ${text.length > 10000 ? '... [text truncated]' : ''}
    `;
    
    // Generate content using the AI SDK
    const result = await generateText({
      model: googleAI("gemini-2.0-flash-001"),
      prompt: prompt,
    });
    
    const response = result.text;
    
    try {
      // Extract the JSON from the response
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                        response.match(/```\n([\s\S]*?)\n```/) || 
                        response.match(/({[\s\S]*})/);
      
      const jsonStr = jsonMatch ? jsonMatch[1] : response;
      const data = JSON.parse(jsonStr);
      
      return {
        summary: data.summary || '',
        keyTopics: data.keyTopics || [],
        documentType: data.documentType || 'unknown'
      };
    } catch (jsonError) {
      console.error('Error parsing document info JSON response:', jsonError);
      return {
        summary: response.slice(0, 200) + '...',
        keyTopics: [],
        documentType: 'unknown'
      };
    }
  } catch (error) {
    console.error('Error extracting document info:', error);
    return {
      summary: '',
      keyTopics: [],
      documentType: 'unknown'
    };
  }
}

// Process a document into chunks with embeddings
export async function processDocument(document: SourceDocument | CompanyDocument): Promise<{
  chunks: Array<{ content: string, embedding: number[] }>,
  metadata: any
}> {
  const { content, metadata = {} } = document;
  
  if (!content || content.trim() === '') {
    throw new Error("Document has no content to process");
  }
  
  // Extract additional document information
  const documentInfo = await extractDocumentInfo(content);
  
  // Enhance metadata with extracted information
  const enhancedMetadata = {
    ...metadata,
    summary: documentInfo.summary,
    keyTopics: documentInfo.keyTopics,
    documentType: documentInfo.documentType,
    chunkingMethod: 'semantic_paragraphs',
    processingTimestamp: new Date().toISOString(),
  };
  
  try {
    // Split content into chunks
    const textChunks = chunkText(content);
    
    // Generate embeddings for each chunk
    const chunksWithEmbeddings = await Promise.all(
      textChunks.map(async (chunk, index) => {
        try {
          const embedding = await generateEmbeddings(chunk);
          return { 
            content: chunk, 
            embedding,
            chunkIndex: index,
            chunkTotal: textChunks.length
          };
        } catch (embeddingError) {
          console.error(`Error generating embedding for chunk ${index}:`, embeddingError);
          throw new Error(`Failed to generate embedding for chunk ${index}: ${(embeddingError as Error).message}`);
        }
      })
    );
    
    return {
      chunks: chunksWithEmbeddings,
      metadata: enhancedMetadata
    };
  } catch (error) {
    console.error("Error processing document:", error);
    throw error;
  }
}

// Process a file into a document object
export async function processFile(
  filePath: string, 
  fileName: string, 
  fileId: string, 
  fileType: string,
  fileSize: number,
  docType: string
): Promise<SourceDocument | CompanyDocument> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  if (!['pdf', 'docx', 'doc', 'txt'].includes(fileType)) {
    throw new Error(`Unsupported file type: ${fileType}. Supported types: pdf, docx, txt`);
  }
  
  try {
    // Extract text and basic metadata from file
    const { text, metadata: fileMetadata } = await extractTextFromFile(filePath, fileType);
    
    if (!text || text.trim() === '') {
      throw new Error(`No text content could be extracted from ${fileName}`);
    }
    
    // Create document object with properties that match SourceDocument and CompanyDocument interfaces
    const document = {
      id: fileId,
      title: fileName,
      content: text,
      type: fileType,
      metadata: {
        ...fileMetadata,
        fileName,
        fileType,
        fileSize,
        docType,
        path: filePath,
        dateAdded: new Date().toISOString(),
        uploadTimestamp: new Date().toISOString(),
      }
    };
    
    return docType === 'company' 
      ? document as CompanyDocument 
      : document as SourceDocument;
  } catch (error) {
    console.error('Error processing file:', error);
    throw new Error(`Failed to process file ${fileName}: ${(error as Error).message}`);
  }
}