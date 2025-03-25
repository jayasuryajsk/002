import { NextRequest, NextResponse } from 'next/server'
import { put, list, del } from '@vercel/blob'

export async function GET(request: NextRequest) {
  console.log('Test Blob API: GET request received')
  
  try {
    // Check if the Blob Storage token is defined
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'BLOB_READ_WRITE_TOKEN is not defined in environment variables' },
        { status: 500 }
      )
    }
    
    console.log(`Blob token is defined with length: ${process.env.BLOB_READ_WRITE_TOKEN.length}`)
    
    // Create a test file
    const testFilename = `test-${Date.now()}.txt`
    console.log(`Creating test file: ${testFilename}`)
    
    try {
      // Try to write a test file
      const blob = await put(
        testFilename,
        'This is a test file to verify Blob Storage is working correctly.',
        { contentType: 'text/plain', access: 'public' }
      )
      
      console.log(`Test file created at URL: ${blob.url}`)
      
      // List all blobs to verify the file was created
      const blobs = await list({})
      console.log(`Found ${blobs.blobs.length} total blobs`)
      
      const foundFile = blobs.blobs.find(b => b.pathname === testFilename)
      
      if (foundFile) {
        console.log('✅ Test file found in Blob Storage')
      } else {
        console.warn('⚠️ Test file not found in Blob Storage')
      }
      
      // Clean up by deleting the test file
      await del(testFilename)
      console.log(`Test file deleted`)
      
      return NextResponse.json({
        success: true,
        message: 'Blob Storage test completed successfully',
        blobUrl: blob.url,
        totalBlobs: blobs.blobs.length,
        testFileFound: !!foundFile
      })
    } catch (error) {
      console.error('Error testing Blob Storage:', error)
      return NextResponse.json(
        { error: 'Failed to test Blob Storage', details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in Test Blob API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
} 