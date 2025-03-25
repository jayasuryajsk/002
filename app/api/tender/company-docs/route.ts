import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { CompanyDocument } from '@/lib/agents/types'
import { LocalDocumentStorage } from '@/lib/local-storage'

// In-memory storage for documents (initially empty, populated from storage)
let companyDocuments: CompanyDocument[] = []

// Load documents from persistent storage
async function loadDocumentsFromStorage() {
  try {
    console.log('Loading company documents from local storage...')
    companyDocuments = await LocalDocumentStorage.getCompanyDocuments()
    console.log(`Loaded ${companyDocuments.length} company documents`)
    return companyDocuments
  } catch (error) {
    console.error('Error loading company documents:', error)
    return []
  }
}

export async function GET(request: NextRequest) {
  console.log('Company Docs API: GET request received')
  
  try {
    // Always refresh from storage to catch deleted files
    console.log('Loading company documents from storage...')
    const documents = await loadDocumentsFromStorage()
    
    // Update in-memory cache
    companyDocuments = documents
    
    console.log(`Returning ${documents.length} company documents`)
    if (documents.length > 0) {
      console.log('Company document titles:', documents.map(doc => doc.title).join(', '))
    }
    
    return NextResponse.json(documents)
  } catch (error) {
    console.error('Error in GET company documents:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve company documents' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  console.log('Company Docs API: POST request received')
  
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
    
    const newDocument: CompanyDocument = {
      id: docId,
      title: file.name,
      content: content,
      binaryData: isPdf || isImage ? new Uint8Array(arrayBuffer) : null,
      type: 'company',
      metadata: {
        dateAdded: new Date().toISOString(),
        fileType: file.type || (isPdf ? 'application/pdf' : 'text/plain'),
        fileSize: file.size,
        path: file.name
      }
    }
    
    // Store in local storage
    await LocalDocumentStorage.storeCompanyDocument(newDocument)
    console.log('Document stored in local storage')
    
    // Add to in-memory array
    companyDocuments.push(newDocument)
    
    // Log all current company documents for debugging
    console.log(`Current company documents (${companyDocuments.length}):`, 
      companyDocuments.map(doc => ({
        id: doc.id,
        title: doc.title,
        type: doc.type
      }))
    )
    
    return NextResponse.json(newDocument)
  } catch (error) {
    console.error('Error in POST company document:', error)
    return NextResponse.json(
      { error: 'Failed to process company document', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  console.log('Company Docs API: DELETE request received')
  
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
    const document = companyDocuments.find(doc => doc.id === id)
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }
    
    console.log(`Deleting company document: ${id} (${document.title})`)
    
    // Delete from local storage
    await LocalDocumentStorage.deleteCompanyDocument(id)
    console.log('Successfully deleted document from local storage')
    
    // Remove from in-memory array
    companyDocuments = companyDocuments.filter(doc => doc.id !== id)
    
    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('Error in DELETE company document:', error)
    return NextResponse.json(
      { error: 'Failed to delete company document' },
      { status: 500 }
    )
  }
} 