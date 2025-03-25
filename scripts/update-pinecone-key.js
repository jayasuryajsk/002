// Script to update Pinecone API key
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Path to the .env file
const envPath = path.join(process.cwd(), '.env');

// Read the .env file
async function updatePineconeKey() {
  console.log('Updating Pinecone API key...');
  
  try {
    // Read the .env file
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Ask for the new API key
    rl.question('Enter your Pinecone API key (from https://app.pinecone.io): ', (apiKey) => {
      if (!apiKey || apiKey.trim() === '') {
        console.error('Error: API key cannot be empty');
        rl.close();
        return;
      }
      
      // Replace the Pinecone API key
      const updatedContent = envContent.replace(
        /PINECONE_API_KEY=.*/,
        `PINECONE_API_KEY=${apiKey.trim()}`
      );
      
      // Write the updated content back to the .env file
      fs.writeFileSync(envPath, updatedContent);
      
      console.log('✅ Pinecone API key updated successfully');
      console.log('Restart your Next.js server for the changes to take effect');
      console.log('Then run "node scripts/test-index.js" to test document indexing');
      
      rl.close();
    });
  } catch (error) {
    console.error('Error updating Pinecone API key:', error);
    rl.close();
  }
}

// Run the update
updatePineconeKey(); 