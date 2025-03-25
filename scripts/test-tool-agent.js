// Script to test the tool-using agent with Pinecone tools
require('dotenv').config();
const { ToolUsingAgent } = require('../lib/agents/tool-using-agent');
const { pineconeTools } = require('../lib/tools/pinecone-tools');

// Command line arguments
const args = process.argv.slice(2);
const query = args.length > 0 ? args.join(' ') : "Tell me about our company's core capabilities and how they match the technical requirements in the RFP.";
const verbose = args.includes('--verbose');

// Configure logging
const log = {
  info: (message) => console.log(`INFO: ${message}`),
  debug: (message) => verbose && console.log(`DEBUG: ${message}`),
  error: (message, error) => console.error(`ERROR: ${message}`, error || '')
};

/**
 * Run a test query with the tool-using agent
 */
async function testToolUsingAgent() {
  log.info('Initializing tool-using agent...');
  
  // Create the agent
  const agent = new ToolUsingAgent();
  
  // Register the Pinecone tools
  agent.registerTools(pineconeTools);
  
  log.info(`Registered ${pineconeTools.length} tools with the agent`);
  log.debug('Registered tools:', pineconeTools.map(t => t.name).join(', '));
  
  // Format the message
  const message = {
    role: "user",
    content: query
  };
  
  log.info(`Sending query to agent: "${query}"`);
  console.log('\nProcessing...\n');
  
  try {
    // Track timing
    const startTime = Date.now();
    
    // Get response from agent
    const response = await agent.processMessage(message);
    
    // Calculate time taken
    const timeTaken = (Date.now() - startTime) / 1000;
    
    // Print the response
    console.log('------ AGENT RESPONSE ------');
    console.log(response.content);
    console.log('---------------------------');
    console.log(`\nTime taken: ${timeTaken.toFixed(2)} seconds`);
    
    return true;
  } catch (error) {
    log.error('Error in test:', error);
    return false;
  }
}

// Show help if requested
if (args.includes('--help')) {
  console.log(`
Tool-Using Agent Test Script

Usage:
  node test-tool-agent.js [query] [options]

Arguments:
  query              The question or request to send to the agent
                     Default: "Tell me about our company's core capabilities and how they match the technical requirements in the RFP."

Options:
  --help             Show this help message
  --verbose          Show more detailed logs

Examples:
  node test-tool-agent.js "What are our company's strengths?"
  node test-tool-agent.js "Create a technical approach section for the bid" --verbose
  `);
  process.exit(0);
}

// Run the test
testToolUsingAgent()
  .then(success => {
    if (success) {
      console.log('\nTest completed successfully');
    } else {
      console.log('\nTest completed with errors');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('\nUnexpected error:', error);
    process.exit(1);
  }); 