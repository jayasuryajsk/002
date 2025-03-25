import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { SourceDocument } from '@/lib/agents/types'
import { LocalDocumentStorage } from '@/lib/local-storage'

// In-memory storage for documents (initially empty, populated from storage)
let sourceDocuments: SourceDocument[] = []

// Load documents from persistent storage
async function loadDocumentsFromStorage() {
  try {
    console.log('Loading source documents from local storage...')
    sourceDocuments = await LocalDocumentStorage.getSourceDocuments()
    console.log(`Loaded ${sourceDocuments.length} source documents`)
    return sourceDocuments
  } catch (error) {
    console.error('Error loading source documents:', error)
    return []
  }
}

export async function GET(request: NextRequest) {
  console.log('Sources API: GET request received')
  
  try {
    // Always refresh from storage to catch deleted files
    console.log('Loading source documents from storage...')
    const documents = await loadDocumentsFromStorage()
    
    // Update in-memory cache
    sourceDocuments = documents
    
    console.log(`Returning ${documents.length} source documents`)
    if (documents.length > 0) {
      console.log('Source document titles:', documents.map(doc => doc.title).join(', '))
    }
    
    return NextResponse.json(documents)
  } catch (error) {
    console.error('Error in GET source documents:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve source documents' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  console.log('Sources API: POST request received')
  
  try {
    // Ensure documents are loaded
    await loadDocumentsFromStorage()
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    
    console.log(`Processing uploaded file: ${file.name} (${file.type}, ${file.size} bytes)`)
    
    // Generate a unique ID for the document
    const docId = uuidv4()
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isImage = file.type.startsWith('image/')
    
    // Convert file to buffer for storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Create the document object
    let content: string = ""
    
    // For PDF and images, we'll store the binary data
    if (isPdf || isImage) {
      content = `Binary content stored separately`
    } else {
      // For text files, we can read the content
      try {
        content = await file.text()
      } catch (e) {
        console.error(`Error reading file text:`, e)
        content = `Content could not be read`
      }
    }
    
    const newDocument: SourceDocument = {
      id: docId,
      title: file.name,
      content: content,
      binaryData: isPdf || isImage ? new Uint8Array(arrayBuffer) : null,
      type: 'requirements',
      metadata: {
        dateAdded: new Date().toISOString(),
        fileType: file.type || (isPdf ? 'application/pdf' : 'text/plain'),
        fileSize: file.size,
        path: file.name
      }
    }
    
    // Store in local storage
    await LocalDocumentStorage.storeSourceDocument(newDocument)
    console.log('Document stored in local storage')
    
    // Add to in-memory array
    sourceDocuments.push(newDocument)
    
    // Log all current source documents for debugging
    console.log(`Current source documents (${sourceDocuments.length}):`, 
      sourceDocuments.map(doc => ({
        id: doc.id,
        title: doc.title,
        type: doc.type
      }))
    )
    
    return NextResponse.json(newDocument)
  } catch (error) {
    console.error('Error in POST source document:', error)
    return NextResponse.json(
      { error: 'Failed to process source document', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  console.log('Sources API: DELETE request received')
  
  try {
    // Ensure documents are loaded
    await loadDocumentsFromStorage()
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'No document ID provided' },
        { status: 400 }
      )
    }
    
    // Find the document to get its title
    const document = sourceDocuments.find(doc => doc.id === id)
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }
    
    console.log(`Deleting source document: ${id} (${document.title})`)
    
    // Delete from local storage
    await LocalDocumentStorage.deleteSourceDocument(id)
    console.log('Successfully deleted document from local storage')
    
    // Remove from in-memory array
    sourceDocuments = sourceDocuments.filter(doc => doc.id !== id)
    
    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('Error in DELETE source document:', error)
    return NextResponse.json(
      { error: 'Failed to delete source document' },
      { status: 500 }
    )
  }
}