import { NextRequest } from 'next/server';
import { list } from '@vercel/blob';

// Simple debug endpoint to check environment variables and Blob Storage connectivity
export async function GET(req: NextRequest) {
  // Get environment variables (redacted for security)
  const envVars = {
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ? '[REDACTED, LENGTH: ' + process.env.BLOB_READ_WRITE_TOKEN.length + ']' : 'undefined',
    NODE_ENV: process.env.NODE_ENV || 'undefined',
  };

  // Test Blob Storage connectivity
  let blobStatus = "Unknown";
  try {
    await list({ prefix: 'test-connection/' });
    blobStatus = "Connected successfully";
  } catch (error: any) {
    blobStatus = `Error: ${error.message || 'Unknown error'}`;
  }

  // Return debug information
  return Response.json({
    environment: envVars,
    blobStorage: {
      status: blobStatus,
      timestamp: new Date().toISOString()
    },
    server: {
      timestamp: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version
    }
  });
} 