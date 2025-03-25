// Script to refresh sources from disk
const http = require('http');

async function refreshSources() {
  console.log('Refreshing sources from storage...');
  
  try {
    // Get the local server URL (assuming it's running on port 3000 or 3001)
    const baseUrl = 'http://localhost';
    const ports = [3000, 3001];
    let response = null;
    
    // Try both ports
    for (const port of ports) {
      try {
        console.log(`Trying to connect to ${baseUrl}:${port}/api/tender/sources?refresh=true`);
        
        // Make a request to the sources API with refresh=true
        response = await fetch(`${baseUrl}:${port}/api/tender/sources?refresh=true`);
        
        if (response.ok) {
          console.log(`Successfully connected to server on port ${port}`);
          break;
        }
      } catch (err) {
        console.log(`Server not available on port ${port}`);
      }
    }
    
    if (!response || !response.ok) {
      throw new Error('Could not connect to the server on any port');
    }
    
    const data = await response.json();
    
    console.log(`Sources refreshed. Found ${data.length} documents.`);
    if (data.length > 0) {
      console.log('Document titles:', data.map(doc => doc.title).join(', '));
    } else {
      console.log('No documents found, which means the refresh was successful!');
    }
    
    return data;
  } catch (error) {
    console.error('Error refreshing sources:', error);
    return null;
  }
}

// Run the refresh
refreshSources(); 