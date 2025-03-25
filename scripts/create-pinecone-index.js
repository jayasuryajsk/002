// Script to create a Pinecone index with the correct configuration
require('dotenv').config();
const https = require('https');

const API_KEY = process.env.PINECONE_API_KEY;
const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'tender-documents';

// Function to make a simple HTTPS request
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Response status: ${res.statusCode}`);
        try {
          if (data) {
            const parsedData = JSON.parse(data);
            resolve({ statusCode: res.statusCode, data: parsedData });
          } else {
            resolve({ statusCode: res.statusCode, data: {} });
          }
        } catch (e) {
          console.log('Raw response:', data);
          resolve({ statusCode: res.statusCode, data });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    
    req.end();
  });
}

// Check if an index exists
async function checkIndexExists() {
  const options = {
    hostname: 'api.pinecone.io',
    port: 443,
    path: `/indexes/${INDEX_NAME}`,
    method: 'GET',
    headers: {
      'Api-Key': API_KEY,
      'Accept': 'application/json'
    }
  };
  
  try {
    const response = await makeRequest(options);
    return response.statusCode === 200;
  } catch (error) {
    return false;
  }
}

// Create a new index
async function createIndex() {
  const options = {
    hostname: 'api.pinecone.io',
    port: 443,
    path: '/indexes',
    method: 'POST',
    headers: {
      'Api-Key': API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };
  
  const postData = {
    name: INDEX_NAME,
    dimension: 768,
    metric: 'cosine',
    spec: {
      serverless: {
        cloud: 'aws',
        region: 'us-east-1'
      }
    }
  };
  
  return makeRequest(options, postData);
}

// Main function to set up Pinecone index
async function setupPineconeIndex() {
  console.log(`Setting up Pinecone index (${INDEX_NAME})...`);
  
  try {
    // Check if the index already exists
    console.log('Checking if index already exists...');
    const indexExists = await checkIndexExists();
    
    if (indexExists) {
      console.log(`Index '${INDEX_NAME}' already exists!`);
      return true;
    } else {
      console.log(`Creating new index: ${INDEX_NAME}`);
      const response = await createIndex();
      
      if (response.statusCode === 201 || response.statusCode === 200) {
        console.log('Index created successfully!');
        console.log('Please wait a few minutes for the index to become ready.');
        return true;
      } else {
        console.error('Failed to create index:', response);
        return false;
      }
    }
  } catch (error) {
    console.error('Error setting up Pinecone index:', error);
    return false;
  }
}

// Run the setup
setupPineconeIndex()
  .then(success => {
    if (success) {
      console.log('\n✅ Pinecone index setup initiated successfully!');
      console.log('\nNext steps:');
      console.log('1. Wait a few minutes for the index to become ready');
      console.log('2. Restart your server');
      console.log('3. Upload documents through the UI');
      console.log('4. Generate a tender - Your documents will now be properly indexed!');
    } else {
      console.log('\n❌ Pinecone index setup failed.');
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
  }); 