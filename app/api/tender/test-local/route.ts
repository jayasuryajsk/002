import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { LocalDocumentStorage } from '@/lib/local-storage'
import fs from 'fs'
import path from 'path'

export async function GET(request: NextRequest) {
  console.log('Test Local Storage API: GET request received')
  
  try {
    // Check if local-storage directory exists
    const localStorageDir = path.join(process.cwd(), 'local-storage')
    const sourceDocsDir = path.join(localStorageDir, 'source-docs')
    
    // Create directories if they don't exist
    if (!fs.existsSync(localStorageDir)) {
      fs.mkdirSync(localStorageDir, { recursive: true })
      console.log(`Created directory: ${localStorageDir}`)
    }
    
    if (!fs.existsSync(sourceDocsDir)) {
      fs.mkdirSync(sourceDocsDir, { recursive: true })
      console.log(`Created directory: ${sourceDocsDir}`)
    }
    
    // Create a test document
    const docId = uuidv4()
    const testDocument = {
      id: docId,
      title: 'Test Document',
      content: 'This is a test document to verify local storage is working correctly.',
      type: 'requirements',
      metadata: {
        dateAdded: new Date().toISOString(),
        fileType: 'text/plain',
        fileSize: 0,
        path: 'test-document.txt'
      }
    }
    
    // Store the test document
    await LocalDocumentStorage.storeSourceDocument(testDocument)
    console.log(`Test document stored with ID: ${docId}`)
    
    // Retrieve all source documents
    const sourceDocuments = await LocalDocumentStorage.getSourceDocuments()
    console.log(`Retrieved ${sourceDocuments.length} source documents`)
    
    // Find our test document
    const foundDocument = sourceDocuments.find(doc => doc.id === docId)
    
    // Clean up by deleting the test document
    await LocalDocumentStorage.deleteSourceDocument(docId)
    console.log(`Test document deleted`)
    
    // List files in the source-docs directory
    const files = fs.readdirSync(sourceDocsDir)
    console.log(`Files in source-docs directory: ${files.join(', ')}`)
    
    return NextResponse.json({
      success: true,
      message: 'Local storage test completed successfully',
      directoryExists: fs.existsSync(sourceDocsDir),
      testDocumentCreated: !!foundDocument,
      sourceDocumentsCount: sourceDocuments.length,
      filesInDirectory: files
    })
  } catch (error) {
    console.error('Error in Test Local Storage API:', error)
    return NextResponse.json(
      { error: 'Failed to test local storage', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
} 