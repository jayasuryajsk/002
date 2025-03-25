import { NextRequest } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { SourceDocument } from '@/lib/agents/types'
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import * as path from 'path'
import * as os from 'os'

// In-memory storage for demo purposes
// In production, this should use a proper database
declare global {
  var companyDocuments: SourceDocument[]
}

// Create local directory for company PDF storage
const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'local-storage', 'tender-company-docs')
if (!existsSync(LOCAL_STORAGE_DIR)) {
  try {
    mkdirSync(LOCAL_STORAGE_DIR, { recursive: true })
    console.log(`Created company docs local storage directory: ${LOCAL_STORAGE_DIR}`)
  } catch (error) {
    console.error(`Failed to create company docs local storage directory: ${error}`)
  }
}

// Load documents from local storage on startup
function loadCompanyDocumentsFromDisk() {
  try {
    const metadataPath = path.join(LOCAL_STORAGE_DIR, 'metadata.json')
    if (existsSync(metadataPath)) {
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
      global.companyDocuments = metadata.map((doc: any) => {
        // For PDFs, load the binary data from disk
        if (doc.metadata?.fileType === 'application/pdf') {
          try {
            const pdfPath = path.join(LOCAL_STORAGE_DIR, `${doc.id}.pdf`)
            if (existsSync(pdfPath)) {
              const binaryData = readFileSync(pdfPath)
              return {
                ...doc,
                binaryData: new Uint8Array(binaryData),
              }
            }
          } catch (error) {
            console.error(`Error loading company PDF for ${doc.title}:`, error)
          }
        }
        return doc
      })
      console.log(`Loaded ${global.companyDocuments.length} company documents from disk`)
    }
  } catch (error) {
    console.error('Error loading company documents from disk:', error)
  }
}

// Initialize global storage if it doesn't exist
if (!global.companyDocuments) {
  global.companyDocuments = []
  console.log('Initialized empty companyDocuments array')
  // Try to load from disk
  loadCompanyDocumentsFromDisk()
} else {
  console.log(`Found existing companyDocuments array with ${global.companyDocuments.length} documents`)
}

// Helper function to save documents to disk
function saveCompanyDocumentsToDisk() {
  try {
    // Create directory if it doesn't exist
    if (!existsSync(LOCAL_STORAGE_DIR)) {
      mkdirSync(LOCAL_STORAGE_DIR, { recursive: true })
      console.log(`Created company docs local storage directory: ${LOCAL_STORAGE_DIR}`)
    }
    
    // Save metadata without binary data
    const metadata = global.companyDocuments.map(doc => {
      const { binaryData, ...rest } = doc
      return rest
    })
    
    const metadataPath = path.join(LOCAL_STORAGE_DIR, 'metadata.json')
    writeFileSync(
      metadataPath,
      JSON.stringify(metadata, null, 2)
    )
    
    console.log(`Saved company metadata to: ${metadataPath}`)
    
    // Save each PDF file individually
    let pdfsSaved = 0
    global.companyDocuments.forEach(doc => {
      if (doc.binaryData && doc.metadata?.fileType === 'application/pdf') {
        const pdfPath = path.join(LOCAL_STORAGE_DIR, `${doc.id}.pdf`)
        writeFileSync(
          pdfPath,
          Buffer.from(doc.binaryData)
        )
        pdfsSaved++
      }
    })
    
    console.log(`Saved ${global.companyDocuments.length} company documents metadata and ${pdfsSaved} PDFs to disk at ${LOCAL_STORAGE_DIR}`)
  } catch (error) {
    console.error('Error saving company documents to disk:', error)
  }
}

export async function GET() {
  console.log(`GET /api/tender/company - Returning ${global.companyDocuments.length} documents`)
  return Response.json(global.companyDocuments)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      console.error('POST /api/tender/company - No file uploaded')
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
      // Even if not a PDF, we'll convert text to PDF later in the generate endpoint
      // Just store the content for now
      content = await file.text();
    }

    const docId = uuidv4()
    
    const companyDoc: SourceDocument = {
      id: docId,
      title: file.name,
      content,
      binaryData,
      type: 'company' as any,
      metadata: {
        dateAdded: new Date().toISOString(),
        fileType: file.type,
        fileSize: file.size,
        path: file.name
      }
    }

    global.companyDocuments.push(companyDoc)
    console.log(`Added company document: ${file.name} (${file.size} bytes), total: ${global.companyDocuments.length}`)
    
    // Save to disk for persistence
    saveCompanyDocumentsToDisk()

    // Log all document titles for debugging
    console.log('Current company documents:')
    global.companyDocuments.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.title} (${doc.metadata?.fileSize || 0} bytes)`)
    })
    
    return Response.json(companyDoc)

  } catch (error) {
    console.error('Error processing company document:', error)
    return new Response('Error processing document', { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  
  const initialLength = global.companyDocuments.length
  global.companyDocuments = global.companyDocuments.filter(doc => doc.id !== id)
  
  // Save updated list to disk
  saveCompanyDocumentsToDisk()
  
  console.log(`Deleted company document, remaining: ${global.companyDocuments.length}`)
  return new Response(null, { status: 204 })
} 