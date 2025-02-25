import { NextRequest } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { SourceDocument } from '@/lib/agents/types'

// In-memory storage for company documents
// In production, this should use a proper database
// Use the SourceDocument type for consistency
declare global {
  var companyDocuments: SourceDocument[]
}

// Initialize global storage if it doesn't exist
if (!global.companyDocuments) {
  global.companyDocuments = []
  console.log('Initialized empty companyDocuments array')
} else {
  console.log(`Found existing companyDocuments array with ${global.companyDocuments.length} documents`)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  
  if (id) {
    const document = global.companyDocuments.find(doc => doc.id === id)
    if (!document) {
      console.log(`GET /api/tender/company-docs - Document with ID ${id} not found`)
      return new Response('Document not found', { status: 404 })
    }
    console.log(`GET /api/tender/company-docs - Returning document with ID ${id}`)
    return Response.json(document)
  }
  
  console.log(`GET /api/tender/company-docs - Returning ${global.companyDocuments.length} documents`)
  return Response.json(global.companyDocuments)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      console.error('POST /api/tender/company-docs - No file uploaded')
      return new Response('No file uploaded', { status: 400 })
    }

    // Store binary data for PDFs, text for other files
    let content: string | Uint8Array;
    let binaryData: Uint8Array | null = null;
    
    if (file.type === 'application/pdf') {
      const bytes = await file.arrayBuffer();
      binaryData = new Uint8Array(bytes);
      content = "PDF document - binary content stored separately";
    } else {
      content = await file.text();
    }
    
    const docId = uuidv4()
    
    const companyDoc: SourceDocument = {
      id: docId,
      title: file.name,
      content,
      binaryData,
      type: 'other', // Use 'other' type since 'company' is not in the enum
      metadata: {
        dateAdded: new Date().toISOString(),
        fileType: file.type,
        fileSize: file.size,
        path: file.name
      }
    }

    global.companyDocuments.push(companyDoc)
    console.log(`Added company document: ${file.name} (${file.size} bytes), total: ${global.companyDocuments.length}`)
    
    // Log all document titles for debugging
    console.log('Current company documents:')
    global.companyDocuments.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.title} (${doc.metadata?.fileSize || 0} bytes)`)
    })
    
    return Response.json({
      id: docId,
      fileName: file.name
    })

  } catch (error) {
    console.error('Error processing company document:', error)
    return new Response('Error processing document', { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  
  if (!id) {
    console.error('DELETE /api/tender/company-docs - No document ID provided')
    return new Response('Document ID is required', { status: 400 })
  }
  
  const initialLength = global.companyDocuments.length
  global.companyDocuments = global.companyDocuments.filter(doc => doc.id !== id)
  
  if (global.companyDocuments.length === initialLength) {
    console.log(`DELETE /api/tender/company-docs - Document with ID ${id} not found`)
    return new Response('Document not found', { status: 404 })
  }
  
  console.log(`Deleted company document, remaining: ${global.companyDocuments.length}`)
  return new Response(null, { status: 204 })
} 