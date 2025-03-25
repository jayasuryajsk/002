// Minimal test for Pinecone connection
import { Pinecone } from '@pinecone-database/pinecone';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    console.log('Pinecone test API called');
    
    // Read API key directly from .env file
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Extract Pinecone API key using regex
    const apiKeyMatch = envContent.match(/PINECONE_API_KEY=([^\r\n]+)/);
    const indexNameMatch = envContent.match(/PINECONE_INDEX_NAME=([^\r\n]+)/);
    
    const apiKey = apiKeyMatch ? apiKeyMatch[1] : '';
    const indexName = indexNameMatch ? indexNameMatch[1] : 'tender-documents';
    
    console.log(`Direct read from .env file`);
    console.log(`API Key length: ${apiKey.length}`);
    console.log(`API Key first 5 chars: ${apiKey.substring(0, 5)}...`);
    console.log(`Index name: ${indexName}`);
    
    // For comparison, log the environment variable
    console.log(`\nFrom process.env:`);
    console.log(`API Key length: ${process.env.PINECONE_API_KEY ? process.env.PINECONE_API_KEY.length : 0}`);
    console.log(`API Key first 5 chars: ${process.env.PINECONE_API_KEY ? process.env.PINECONE_API_KEY.substring(0, 5) : 'none'}...`);
    
    // Initialize Pinecone with the directly-read API key
    console.log('\nInitializing Pinecone client with directly-read API key...');
    const pinecone = new Pinecone({
      apiKey: apiKey,
    });
    
    // List indexes
    console.log('Listing Pinecone indexes...');
    const indexes = await pinecone.listIndexes();
    
    // Return results
    return res.status(200).json({
      success: true,
      message: 'Successfully connected to Pinecone',
      apiKeyMethod: 'direct file read',
      apiKeyLength: apiKey.length,
      indexes: indexes.indexes ? indexes.indexes.map(idx => idx.name) : [],
      indexCount: indexes.indexes ? indexes.indexes.length : 0
    });
  } catch (error) {
    console.error('Error in Pinecone test API:', error);
    return res.status(500).json({
      error: 'Failed to connect to Pinecone',
      details: error instanceof Error ? error.message : String(error)
    });
  }
} 