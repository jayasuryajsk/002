import { NextRequest, NextResponse } from 'next/server'
import { list, put, del } from '@vercel/blob'

// Folder constants
const SOURCE_DOCS_FOLDER = 'source-docs/';
const COMPANY_DOCS_FOLDER = 'company-docs/';

export async function GET(request: NextRequest) {
  console.log('Migrate Docs API: GET request received');
  
  try {
    // Check for authorization (optional parameter to prevent unauthorized access)
    const authKey = request.nextUrl.searchParams.get('key');
    if (authKey !== process.env.MIGRATE_AUTH_KEY && process.env.MIGRATE_AUTH_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }
    
    // List all blobs
    console.log('Listing all blobs...');
    const blobs = await list({});
    console.log(`Found ${blobs.blobs.length} total blobs`);
    
    // Track migration results
    const results = {
      total: blobs.blobs.length,
      migrated: 0,
      skipped: 0,
      errors: 0,
      details: [] as string[]
    };
    
    // Find all metadata files that are not in folders
    const metadataBlobs = blobs.blobs.filter(blob => 
      blob.pathname.endsWith('-metadata.json') && 
      !blob.pathname.startsWith(SOURCE_DOCS_FOLDER) && 
      !blob.pathname.startsWith(COMPANY_DOCS_FOLDER)
    );
    
    console.log(`Found ${metadataBlobs.length} metadata files to migrate`);
    
    // Process each metadata file
    for (const blob of metadataBlobs) {
      try {
        console.log(`Processing ${blob.pathname}...`);
        
        // Fetch the metadata
        const response = await fetch(blob.url);
        const metadata = await response.json();
        
        // Determine document type
        const docType = metadata.docType || 'source'; // Default to source if not specified
        const targetFolder = docType === 'source' ? SOURCE_DOCS_FOLDER : COMPANY_DOCS_FOLDER;
        
        // Create new paths
        const newMetadataPath = `${targetFolder}${blob.pathname}`;
        const oldStorageKey = metadata.storageKey || blob.pathname.replace('-metadata.json', '');
        const newStorageKey = `${targetFolder}${oldStorageKey.split('/').pop()}`;
        
        console.log(`Migrating metadata from ${blob.pathname} to ${newMetadataPath}`);
        console.log(`Migrating content from ${oldStorageKey} to ${newStorageKey}`);
        
        // Update the storage key in metadata
        metadata.storageKey = newStorageKey;
        
        // Store the updated metadata in the new location
        await put(
          newMetadataPath,
          JSON.stringify(metadata, null, 2),
          { contentType: 'application/json', access: 'public' }
        );
        
        // Find and migrate the content file
        const contentBlob = blobs.blobs.find(b => b.pathname === oldStorageKey);
        if (contentBlob) {
          // Fetch the content
          const contentResponse = await fetch(contentBlob.url);
          const contentType = contentBlob.url.endsWith('.pdf') ? 'application/pdf' : 'text/plain';
          
          // Store in new location
          if (contentType === 'application/pdf') {
            const arrayBuffer = await contentResponse.arrayBuffer();
            await put(
              newStorageKey,
              Buffer.from(arrayBuffer),
              { contentType, access: 'public' }
            );
          } else {
            const content = await contentResponse.text();
            await put(
              newStorageKey,
              content,
              { contentType, access: 'public' }
            );
          }
          
          // Delete the old content file
          await del(oldStorageKey);
          console.log(`Migrated and deleted content file: ${oldStorageKey}`);
        } else {
          console.warn(`Could not find content file for ${blob.pathname}`);
          results.details.push(`Could not find content file for ${blob.pathname}`);
        }
        
        // Delete the old metadata file
        await del(blob.pathname);
        console.log(`Migrated and deleted metadata file: ${blob.pathname}`);
        
        results.migrated++;
        results.details.push(`Successfully migrated ${blob.pathname} to ${newMetadataPath}`);
      } catch (error) {
        console.error(`Error migrating ${blob.pathname}:`, error);
        results.errors++;
        results.details.push(`Error migrating ${blob.pathname}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Count documents that were already in the right folders
    const existingSourceDocs = blobs.blobs.filter(blob => 
      blob.pathname.startsWith(SOURCE_DOCS_FOLDER) && blob.pathname.endsWith('-metadata.json')
    ).length;
    
    const existingCompanyDocs = blobs.blobs.filter(blob => 
      blob.pathname.startsWith(COMPANY_DOCS_FOLDER) && blob.pathname.endsWith('-metadata.json')
    ).length;
    
    results.skipped = existingSourceDocs + existingCompanyDocs;
    
    return NextResponse.json({
      message: 'Document migration completed',
      results,
      existingDocuments: {
        source: existingSourceDocs,
        company: existingCompanyDocs
      }
    });
  } catch (error) {
    console.error('Error in Migrate Docs API:', error);
    return NextResponse.json(
      { error: 'Failed to migrate documents', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 