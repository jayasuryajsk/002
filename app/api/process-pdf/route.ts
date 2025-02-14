import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

// In-memory storage for PDF contents
const pdfStorage = new Map<string, number[]>()

export const config = {
  api: {
    bodyParser: false,
  },
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Array.from(new Uint8Array(bytes))
    
    // Generate a unique ID and store the PDF content
    const fileId = uuidv4()
    pdfStorage.set(fileId, buffer)

    return NextResponse.json({ 
      success: true, 
      fileId,
      fileName: file.name
    })
  } catch (error) {
    console.error("PDF upload error:", error)
    return NextResponse.json({ error: "Failed to upload PDF" }, { status: 500 })
  }
}

// Add an endpoint to retrieve PDF content
export async function GET(req: Request) {
  const url = new URL(req.url)
  const fileId = url.searchParams.get('fileId')
  
  if (!fileId || !pdfStorage.has(fileId)) {
    return NextResponse.json({ error: "PDF not found" }, { status: 404 })
  }

  return NextResponse.json({ 
    content: pdfStorage.get(fileId)
  })
}

