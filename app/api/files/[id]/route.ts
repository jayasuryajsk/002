import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Local storage paths
const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'local-storage');
const SOURCE_DOCS_DIR = path.join(LOCAL_STORAGE_DIR, 'source-docs');
const COMPANY_DOCS_DIR = path.join(LOCAL_STORAGE_DIR, 'company-docs');

/**
 * API endpoint to serve document files (PDFs, etc.)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }
    
    console.log(`File API: GET request for document ID: ${id}`);
    
    // Check in source documents directory
    let contentPath = path.join(SOURCE_DOCS_DIR, `${id}-content`);
    let metadataPath = path.join(SOURCE_DOCS_DIR, `${id}-metadata.json`);
    
    // If not found in source docs, check company docs
    if (!fs.existsSync(contentPath)) {
      contentPath = path.join(COMPANY_DOCS_DIR, `${id}-content`);
      metadataPath = path.join(COMPANY_DOCS_DIR, `${id}-metadata.json`);
      
      // If still not found, return 404
      if (!fs.existsSync(contentPath)) {
        console.log(`File not found for ID: ${id}`);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
    }
    
    // Read metadata to get content type
    let contentType = 'application/octet-stream'; // Default
    if (fs.existsSync(metadataPath)) {
      try {
        const metadataRaw = fs.readFileSync(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataRaw);
        contentType = metadata.metadata?.fileType || 'application/octet-stream';
      } catch (error) {
        console.error('Error reading metadata:', error);
      }
    }
    
    // Read the binary file
    const fileBuffer = fs.readFileSync(contentPath);
    
    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=300'
      }
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
} 