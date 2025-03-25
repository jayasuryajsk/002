// Script to update Pinecone API key in .env file
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const envPath = path.join(process.cwd(), '.env');

async function updatePineconeApiKey() {
  try {
    // Read the current .env file
    const envData = fs.readFileSync(envPath, 'utf8');
    
    console.log('\n🔑 Pinecone API Key Updater 🔑\n');
    console.log('Please enter your new Pinecone API key from the Pinecone console (https://app.pinecone.io)');
    
    // Prompt for the new API key
    rl.question('New Pinecone API key: ', (newApiKey) => {
      if (!newApiKey || newApiKey.trim() === '') {
        console.log('❌ Error: API key cannot be empty. No changes were made.');
        rl.close();
        return;
      }
      
      // Replace the API key in the .env file
      const updatedEnvData = envData.replace(
        /PINECONE_API_KEY=.*/,
        `PINECONE_API_KEY=${newApiKey.trim()}`
      );
      
      // Write the updated .env file
      fs.writeFileSync(envPath, updatedEnvData, 'utf8');
      
      console.log('\n✅ Pinecone API key updated successfully!');
      console.log('\n⚠️ Important: Restart your Next.js server for the changes to take effect.');
      console.log('After restarting, run the test script with: node scripts/test-index.js\n');
      
      rl.close();
    });
  } catch (error) {
    console.error('❌ Error updating Pinecone API key:', error.message);
    rl.close();
  }
}

updatePineconeApiKey(); 