// Simple script to check Pinecone API key validity with direct HTTP requests
require('dotenv').config();
const https = require('https');

const API_KEY = process.env.PINECONE_API_KEY;

console.log(`Testing Pinecone API key: ${API_KEY.substring(0, 5)}...`);

// Function to make a simple HTTPS request
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Response status: ${res.statusCode}`);
        try {
          const parsedData = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsedData });
        } catch (e) {
          console.log('Raw response:', data);
          resolve({ statusCode: res.statusCode, data });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

async function checkPineconeAPI() {
  try {
    // Try listing indexes via a direct API call
    const options = {
      hostname: 'api.pinecone.io',
      port: 443,
      path: '/indexes',
      method: 'GET',
      headers: {
        'Api-Key': API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
    
    console.log('Sending request to Pinecone API...');
    const response = await makeRequest(options);
    
    if (response.statusCode === 200) {
      console.log('✅ Pinecone API key is valid!');
      console.log('Available indexes:', response.data.indexes || []);
      return true;
    } else {
      console.log('❌ Pinecone API response indicates a problem:');
      console.log(response.data);
      
      if (response.statusCode === 401 || response.statusCode === 403) {
        console.log('\n⚠️ The API key appears to be invalid or unauthorized.');
        console.log('Please check that you have:');
        console.log('1. Copied the correct API key from your Pinecone console');
        console.log('2. The API key has the necessary permissions');
        console.log('3. Your Pinecone account is active');
      } else if (response.statusCode === 404) {
        console.log('\n⚠️ The API endpoint could not be found.');
        console.log('This might indicate a change in the Pinecone API or a DNS issue.');
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error checking Pinecone API:', error);
    return false;
  }
}

// Run the check
checkPineconeAPI()
  .then(isValid => {
    if (isValid) {
      console.log('\nYour Pinecone API key is working correctly.');
      console.log('You can now run the create-pinecone-index.js script to create an index.');
    } else {
      console.log('\nPlease update your .env file with a valid Pinecone API key.');
    }
  })
  .catch(error => {
    console.error('Unexpected error during API check:', error);
  }); 