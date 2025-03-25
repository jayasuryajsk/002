import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export async function GET(request: NextRequest) {
  console.log('Debug Docs API: GET request received')
  
  try {
    // List all blobs to see what's actually in storage
    console.log('Listing all blobs...')
    const allBlobs = await list({})
    
    // Categorize blobs
    const pdfFiles = allBlobs.blobs.filter(blob => blob.pathname.endsWith('.pdf'))
    const metadataFiles = allBlobs.blobs.filter(blob => blob.pathname.endsWith('-metadata.json'))
    const sourceDocsFolder = allBlobs.blobs.filter(blob => blob.pathname.startsWith('source-docs/'))
    const companyDocsFolder = allBlobs.blobs.filter(blob => blob.pathname.startsWith('company-docs/'))
    const otherFiles = allBlobs.blobs.filter(blob => 
      !blob.pathname.endsWith('.pdf') && 
      !blob.pathname.endsWith('-metadata.json') &&
      !blob.pathname.startsWith('source-docs/') &&
      !blob.pathname.startsWith('company-docs/')
    )
    
    // Try to fetch source documents from the sources API
    console.log('Fetching source documents from API...')
    let apiDocuments = []
    try {
      const sourcesResponse = await fetch(`${new URL(request.url).origin}/api/tender/sources`)
      if (sourcesResponse.ok) {
        apiDocuments = await sourcesResponse.json()
      }
    } catch (apiError) {
      console.error('Error fetching from sources API:', apiError)
    }
    
    // Return comprehensive debug information
    return NextResponse.json({
      blobStorage: {
        totalBlobs: allBlobs.blobs.length,
        pdfFiles: {
          count: pdfFiles.length,
          files: pdfFiles.map(blob => ({
            pathname: blob.pathname,
            url: blob.url,
            size: blob.size
          }))
        },
        metadataFiles: {
          count: metadataFiles.length,
          files: metadataFiles.map(blob => ({
            pathname: blob.pathname,
            url: blob.url
          }))
        },
        sourceDocsFolder: {
          count: sourceDocsFolder.length,
          files: sourceDocsFolder.map(blob => blob.pathname)
        },
        companyDocsFolder: {
          count: companyDocsFolder.length,
          files: companyDocsFolder.map(blob => blob.pathname)
        },
        otherFiles: {
          count: otherFiles.length,
          files: otherFiles.map(blob => blob.pathname)
        }
      },
      apiDocuments: {
        count: Array.isArray(apiDocuments) ? apiDocuments.length : 0,
        documents: Array.isArray(apiDocuments) ? apiDocuments.map(doc => ({
          id: doc.id,
          title: doc.title,
          type: doc.type,
          hasContent: !!doc.content
        })) : 'Not an array'
      },
      environment: {
        hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
        tokenLength: process.env.BLOB_READ_WRITE_TOKEN ? process.env.BLOB_READ_WRITE_TOKEN.length : 0
      }
    })
  } catch (error) {
    console.error('Error in Debug Docs API:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve debug information', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
} 