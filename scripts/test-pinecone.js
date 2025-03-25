// Test script to verify Pinecone connection
require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');

async function testPineconeConnection() {
  console.log('Testing Pinecone connection...');
  
  try {
    // Initialize Pinecone client
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    
    // List indexes to verify connection
    console.log('Attempting to list Pinecone indexes...');
    const indexList = await pinecone.listIndexes();
    
    console.log('Successfully connected to Pinecone!');
    console.log('Available indexes:', indexList.indexes?.map(idx => idx.name) || []);
    
    // Check for our index
    const indexName = process.env.PINECONE_INDEX_NAME;
    const indexExists = indexList.indexes?.some(idx => idx.name === indexName);
    
    if (indexExists) {
      console.log(`Index '${indexName}' exists.`);
      
      // Get the index
      const index = pinecone.index(indexName);
      
      // Get stats
      const stats = await index.describeIndexStats();
      console.log('Index stats:', stats);
      
      return true;
    } else {
      console.log(`Index '${indexName}' does not exist yet. It will be created on first use.`);
      return false;
    }
  } catch (error) {
    console.error('Error connecting to Pinecone:', error);
    
    if (error.message.includes('Invalid API key')) {
      console.log('\n⚠️ IMPORTANT: You need to update your .env file with a valid Pinecone API key');
      console.log('1. Sign up at https://www.pinecone.io/');
      console.log('2. Create a project');
      console.log('3. Copy your API key');
      console.log('4. Update the PINECONE_API_KEY value in your .env file\n');
    }
    
    return false;
  }
}

// Run the test
testPineconeConnection()
  .then(success => {
    if (success) {
      console.log('Pinecone connection test succeeded!');
    } else {
      console.log('Pinecone connection test failed. See errors above.');
    }
  })
  .catch(err => {
    console.error('Unexpected error:', err);
  }); 