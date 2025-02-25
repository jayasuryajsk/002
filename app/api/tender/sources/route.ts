import { NextRequest } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { SourceDocument } from '@/lib/agents/types'

// In-memory storage for demo purposes
// In production, this should use a proper database
declare global {
  var sourceDocuments: SourceDocument[]
}

// Initialize global storage if it doesn't exist
if (!global.sourceDocuments) {
  global.sourceDocuments = []
  console.log('Initialized empty sourceDocuments array')
} else {
  console.log(`Found existing sourceDocuments array with ${global.sourceDocuments.length} documents`)
}

export async function GET() {
  console.log(`GET /api/tender/sources - Returning ${global.sourceDocuments.length} documents`)
  return Response.json(global.sourceDocuments)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      console.error('POST /api/tender/sources - No file uploaded')
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

    const sourceDoc: SourceDocument = {
      id: uuidv4(),
      title: file.name,
      content,
      binaryData,
      type: 'requirements',
      metadata: {
        dateAdded: new Date().toISOString(),
        fileType: file.type,
        fileSize: file.size,
        path: file.name
      }
    }

    global.sourceDocuments.push(sourceDoc)
    console.log(`Added source document: ${file.name} (${file.size} bytes), total: ${global.sourceDocuments.length}`)
    
    // Log all document titles for debugging
    console.log('Current source documents:')
    global.sourceDocuments.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.title} (${doc.metadata?.fileSize || 0} bytes)`)
    })
    
    return Response.json(sourceDoc)

  } catch (error) {
    console.error('Error processing source document:', error)
    return new Response('Error processing document', { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  
  const initialLength = global.sourceDocuments.length
  global.sourceDocuments = global.sourceDocuments.filter(doc => doc.id !== id)
  
  console.log(`Deleted source document, remaining: ${global.sourceDocuments.length}`)
  return new Response(null, { status: 204 })
} 