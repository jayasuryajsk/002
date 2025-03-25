import fs from 'fs';
import path from 'path';
import { SourceDocument, CompanyDocument } from './agents/types';

// Local storage paths
const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'local-storage');
const SOURCE_DOCS_DIR = path.join(LOCAL_STORAGE_DIR, 'source-docs');
const COMPANY_DOCS_DIR = path.join(LOCAL_STORAGE_DIR, 'company-docs');

// Ensure directories exist
function ensureDirectoriesExist() {
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(SOURCE_DOCS_DIR)) {
    fs.mkdirSync(SOURCE_DOCS_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(COMPANY_DOCS_DIR)) {
    fs.mkdirSync(COMPANY_DOCS_DIR, { recursive: true });
  }
}

/**
 * Local file storage service as a fallback for Blob Storage
 */
export class LocalDocumentStorage {
  /**
   * Store a source document in local storage
   */
  static async storeSourceDocument(document: SourceDocument): Promise<void> {
    console.log(`LocalDocumentStorage.storeSourceDocument called for document: ${document.id}`);
    await this.storeDocument(document, 'source');
  }

  /**
   * Store a company document in local storage
   */
  static async storeCompanyDocument(document: CompanyDocument): Promise<void> {
    console.log(`LocalDocumentStorage.storeCompanyDocument called for document: ${document.id}`);
    await this.storeDocument(document, 'company');
  }

  /**
   * Internal method to store a document
   */
  private static async storeDocument<T extends { id: string, title: string, content: any, type: string, metadata?: any, binaryData?: Uint8Array | null }>(
    document: T, 
    docType: string
  ): Promise<void> {
    try {
      console.log(`LocalDocumentStorage.storeDocument called for ${docType} document: ${document.id}`);
      
      // Ensure directories exist
      ensureDirectoriesExist();
      
      // Determine the target directory
      const targetDir = docType === 'source' ? SOURCE_DOCS_DIR : COMPANY_DOCS_DIR;
      
      // Create a metadata object
      const metadata = {
        id: document.id,
        title: document.title,
        type: document.type,
        docType: docType,
        metadata: document.metadata || {}
      };
      
      // Store metadata file
      const metadataPath = path.join(targetDir, `${document.id}-metadata.json`);
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      console.log(`Metadata stored at: ${metadataPath}`);
      
      // Store content file
      const contentPath = path.join(targetDir, `${document.id}-content`);
      
      if (document.binaryData) {
        // Store binary data
        fs.writeFileSync(contentPath, Buffer.from(document.binaryData));
        console.log(`Binary data stored at: ${contentPath}`);
      } else if (typeof document.content === 'string') {
        // Store text content
        fs.writeFileSync(contentPath, document.content);
        console.log(`Text content stored at: ${contentPath}`);
      }
      
      console.log(`Successfully stored ${docType} document: ${document.id}`);
    } catch (error) {
      console.error(`Error storing ${docType} document:`, error);
      throw error;
    }
  }

  /**
   * Retrieve all source documents
   */
  static async getSourceDocuments(): Promise<SourceDocument[]> {
    console.log(`LocalDocumentStorage.getSourceDocuments called`);
    return this.getDocuments<SourceDocument>('source');
  }

  /**
   * Retrieve all company documents
   */
  static async getCompanyDocuments(): Promise<CompanyDocument[]> {
    console.log(`LocalDocumentStorage.getCompanyDocuments called`);
    return this.getDocuments<CompanyDocument>('company');
  }

  /**
   * Internal method to retrieve documents
   */
  private static async getDocuments<T>(docType: string): Promise<T[]> {
    try {
      console.log(`LocalDocumentStorage.getDocuments called for type: ${docType}`);
      
      // Ensure directories exist
      ensureDirectoriesExist();
      
      // Determine the target directory
      const targetDir = docType === 'source' ? SOURCE_DOCS_DIR : COMPANY_DOCS_DIR;
      
      // Check if directory exists
      if (!fs.existsSync(targetDir)) {
        console.log(`Directory does not exist: ${targetDir}`);
        return [];
      }
      
      // Get all metadata files
      const files = fs.readdirSync(targetDir);
      const metadataFiles = files.filter(file => file.endsWith('-metadata.json'));
      
      console.log(`Found ${metadataFiles.length} metadata files in ${targetDir}`);
      
      if (metadataFiles.length === 0) {
        return [];
      }
      
      // Parse metadata files and load content
      const documents: T[] = [];
      
      for (const file of metadataFiles) {
        try {
          // Read metadata
          const metadataPath = path.join(targetDir, file);
          const metadataContent = fs.readFileSync(metadataPath, 'utf8');
          const metadata = JSON.parse(metadataContent);
          
          // Read content
          const contentPath = path.join(targetDir, `${metadata.id}-content`);
          
          // Skip files that don't have matching content files (might have been deleted)
          if (!fs.existsSync(contentPath)) {
            console.log(`Content file doesn't exist for ${metadata.id}, skipping`);
            
            // Clean up orphaned metadata file
            try {
              fs.unlinkSync(metadataPath);
              console.log(`Deleted orphaned metadata file: ${metadataPath}`);
            } catch (cleanupError) {
              console.error(`Error deleting orphaned metadata file ${metadataPath}:`, cleanupError);
            }
            
            continue;
          }
          
          let content = '';
          
          try {
            content = fs.readFileSync(contentPath, 'utf8');
          } catch (contentError) {
            console.error(`Error reading content file ${contentPath}:`, contentError);
            continue;
          }
          
          // Create document object
          const doc = {
            id: metadata.id,
            title: metadata.title,
            type: metadata.type,
            content: content,
            metadata: metadata.metadata || {}
          } as unknown as T;
          
          documents.push(doc);
        } catch (error) {
          console.error(`Error processing metadata file ${file}:`, error);
        }
      }
      
      console.log(`Retrieved ${documents.length} ${docType} documents`);
      return documents;
    } catch (error) {
      console.error(`Error retrieving documents of type ${docType}:`, error);
      return [];
    }
  }

  /**
   * Delete a source document
   */
  static async deleteSourceDocument(id: string): Promise<void> {
    console.log(`LocalDocumentStorage.deleteSourceDocument called for ID: ${id}`);
    await this.deleteDocument(id, 'source');
  }

  /**
   * Delete a company document
   */
  static async deleteCompanyDocument(id: string): Promise<void> {
    console.log(`LocalDocumentStorage.deleteCompanyDocument called for ID: ${id}`);
    await this.deleteDocument(id, 'company');
  }

  /**
   * Internal method to delete a document
   */
  private static async deleteDocument(id: string, docType: string): Promise<void> {
    try {
      console.log(`LocalDocumentStorage.deleteDocument called for ID: ${id}`);
      
      // Ensure directories exist
      ensureDirectoriesExist();
      
      // Determine the target directory
      const targetDir = docType === 'source' ? SOURCE_DOCS_DIR : COMPANY_DOCS_DIR;
      
      // Delete metadata file
      const metadataPath = path.join(targetDir, `${id}-metadata.json`);
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
        console.log(`Deleted metadata file: ${metadataPath}`);
      }
      
      // Delete content file
      const contentPath = path.join(targetDir, `${id}-content`);
      if (fs.existsSync(contentPath)) {
        fs.unlinkSync(contentPath);
        console.log(`Deleted content file: ${contentPath}`);
      }
      
      console.log(`Successfully deleted ${docType} document: ${id}`);
    } catch (error) {
      console.error(`Error deleting document ${id}:`, error);
      throw error;
    }
  }
} 