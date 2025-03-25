// Test script for the document indexing API
require('dotenv').config();
// Use native fetch instead of node-fetch which is ESM only
const fetch = globalThis.fetch;

// Configuration
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const API_ENDPOINT = `${API_URL}/api/index-docs`;

async function testDocumentIndexing() {
  console.log(`Testing document indexing API at ${API_ENDPOINT}...`);
  
  try {
    // First check if the endpoint is responding
    console.log('Checking if endpoint is available...');
    const checkResponse = await fetch(API_ENDPOINT);
    
    if (!checkResponse.ok) {
      console.error(`API not available, status: ${checkResponse.status}`);
      console.error(await checkResponse.text());
      return;
    }
    
    console.log('API endpoint is available!');
    const checkData = await checkResponse.json();
    console.log('GET response:', checkData);
    
    // Now attempt to index documents
    console.log('\nSending index request...');
    const indexResponse = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'index',
        refresh: true
      })
    });
    
    if (!indexResponse.ok) {
      console.error(`Failed to index documents, status: ${indexResponse.status}`);
      console.error(await indexResponse.text());
      return;
    }
    
    const indexResult = await indexResponse.json();
    console.log('Indexing result:', JSON.stringify(indexResult, null, 2));
    
    if (indexResult.success) {
      console.log('\n✅ Successfully indexed documents in Pinecone!');
      console.log(`Documents: ${indexResult.documentCount}`);
      console.log(`Chunks: ${indexResult.chunkCount}`);
    } else {
      console.log('\n❌ Failed to index documents');
      console.log(`Error: ${indexResult.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error running test:', error);
  }
}

// Run the test
testDocumentIndexing().catch(console.error); 