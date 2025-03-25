// Simple script to test Pinecone connection directly
require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');

async function testPineconeConnection() {
  try {
    console.log('Testing Pinecone connection...');
    
    // Log environment variables (without showing full key)
    const apiKey = process.env.PINECONE_API_KEY || '';
    const indexName = process.env.PINECONE_INDEX_NAME || 'tender-documents';
    
    console.log(`API Key length: ${apiKey.length}`);
    console.log(`API Key first 5 chars: ${apiKey.substring(0, 5)}...`);
    console.log(`Index name: ${indexName}`);
    
    // Initialize Pinecone
    console.log('\nInitializing Pinecone client...');
    const pinecone = new Pinecone({
      apiKey: apiKey,
    });
    
    // List indexes
    console.log('\nListing Pinecone indexes...');
    const indexes = await pinecone.listIndexes();
    
    console.log('\nSuccessfully connected to Pinecone!');
    console.log('Available indexes:', indexes.indexes ? indexes.indexes.map(idx => idx.name).join(', ') : 'None');
    
    // Check if our index exists
    const ourIndex = indexes.indexes ? indexes.indexes.find(idx => idx.name === indexName) : null;
    if (ourIndex) {
      console.log(`\nIndex '${indexName}' exists!`);
      console.log('Index details:', ourIndex);
      
      // Test getting the index
      console.log('\nTesting access to the index...');
      const index = pinecone.index(indexName);
      
      // Describe index statistics
      const stats = await index.describeIndexStats();
      console.log('Index stats:', stats);
    } else {
      console.log(`\nIndex '${indexName}' does not exist yet.`);
    }
    
  } catch (error) {
    console.error('\n❌ Error testing Pinecone connection:');
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    
    // Additional debugging for specific errors
    if (error.message && error.message.includes('API key')) {
      console.error('\n🔑 API KEY ISSUE:');
      console.error('- Make sure your API key is correctly copied from the Pinecone console');
      console.error('- Check if your API key has sufficient permissions');
      console.error('- Verify your Pinecone service plan is active');
      console.error('- Try generating a new API key in the Pinecone console');
    }
    
    if (error.message && error.message.includes('404')) {
      console.error('\n🔍 INDEX NOT FOUND:');
      console.error('- The index might not exist or might be in a different environment');
      console.error('- Check the spelling of your index name');
      console.error('- You might need to create the index first');
    }
  }
}

testPineconeConnection(); 