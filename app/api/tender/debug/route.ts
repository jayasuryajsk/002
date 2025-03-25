import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

export async function GET() {
  try {
    // Collect environment variable information (masked for security)
    const envInfo = {
      PINECONE_API_KEY: process.env.PINECONE_API_KEY ? `${process.env.PINECONE_API_KEY.substring(0, 3)}...${process.env.PINECONE_API_KEY.substring(-3)}` : 'not set',
      PINECONE_API_KEY_LENGTH: process.env.PINECONE_API_KEY?.length || 0,
      PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME || 'tender-documents',
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? `${process.env.GOOGLE_API_KEY.substring(0, 3)}...${process.env.GOOGLE_API_KEY.substring(-3)}` : 'not set',
      GOOGLE_API_KEY_LENGTH: process.env.GOOGLE_API_KEY?.length || 0,
      NODE_ENV: process.env.NODE_ENV,
    };

    // Test Pinecone connection
    let pineconeStatus = 'Not tested';
    let pineconeIndexes: string[] = [];
    let indexDetails = null;
    let embeddingsTest = 'Not tested';

    try {
      console.log('DEBUG: Testing Pinecone connection...');
      
      const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY || '',
      });
      
      // List indexes
      const indexList = await pinecone.listIndexes();
      pineconeStatus = 'Connected successfully';
      pineconeIndexes = indexList.indexes?.map(idx => idx.name) || [];
      
      // Check for tender-documents index
      const indexName = process.env.PINECONE_INDEX_NAME || 'tender-documents';
      if (pineconeIndexes.includes(indexName)) {
        const index = pinecone.index(indexName);
        const stats = await index.describeIndexStats();
        indexDetails = {
          name: indexName,
          vectorCount: stats.totalRecordCount,
          dimensions: stats.dimension,
        };
      } else {
        indexDetails = {
          name: indexName,
          status: 'Index not found',
          availableIndexes: pineconeIndexes,
        };
      }
    } catch (pineconeError: any) {
      pineconeStatus = `Connection failed: ${pineconeError.message || 'Unknown error'}`;
      console.error('Pinecone connection error:', pineconeError);
    }

    // Test Google AI embeddings
    try {
      console.log('DEBUG: Testing Google AI embeddings...');
      
      const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GOOGLE_API_KEY,
        modelName: 'embedding-001',
      });
      
      const result = await embeddings.embedQuery('test query for embeddings');
      embeddingsTest = `Success - Generated embedding with ${result.length} dimensions`;
    } catch (embeddingsError: any) {
      embeddingsTest = `Failed: ${embeddingsError.message || 'Unknown error'}`;
      console.error('Embeddings test error:', embeddingsError);
    }

    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      environment: envInfo,
      pinecone: {
        connectionStatus: pineconeStatus,
        availableIndexes: pineconeIndexes,
        indexDetails: indexDetails,
      },
      embeddings: {
        status: embeddingsTest,
      },
    });
  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Unknown error in debug endpoint',
      stack: error.stack,
    }, { status: 500 });
  }
} 