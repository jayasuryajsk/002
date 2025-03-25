// Script to test the question answering agent
require('dotenv').config();
const { QuestionAnsweringAgent } = require('../lib/agents/question-answering-agent');

// Command line arguments
const args = process.argv.slice(2);
const question = args[0] || "What are our company's core competencies?";
const documentType = args[1] || "all"; // 'company', 'source', or 'all'
const includeContext = args.includes('--context');
const limit = args.includes('--limit') 
  ? parseInt(args[args.indexOf('--limit') + 1]) 
  : 5;

/**
 * Run a test query against the question answering agent
 */
async function testQuestionAnsweringAgent() {
  console.log(`Question: "${question}"`);
  console.log(`Document type: ${documentType}`);
  console.log(`Limit: ${limit}`);
  console.log(`Include context: ${includeContext}`);
  console.log('\nQuerying...\n');
  
  // Initialize the agent
  const qaAgent = new QuestionAnsweringAgent();
  
  // Format the request
  const request = {
    role: "orchestrator",
    content: JSON.stringify({
      question,
      documentType,
      limit,
      includeContext
    })
  };
  
  try {
    // Get the response
    const startTime = Date.now();
    const response = await qaAgent.processMessage(request);
    const endTime = Date.now();
    
    // Parse the response
    const responseData = JSON.parse(response.content);
    
    // Print the answer
    console.log('------------- ANSWER -------------');
    console.log(responseData.answer);
    console.log('----------------------------------');
    
    // Print metadata
    console.log(`\nResponse time: ${(endTime - startTime) / 1000} seconds`);
    console.log(`Success: ${responseData.success}`);
    
    // Print context if included
    if (includeContext && responseData.context && responseData.context.length > 0) {
      console.log('\n------------ CONTEXT -------------');
      responseData.context.forEach((item, index) => {
        console.log(`\n[Source ${index + 1}] ${item.metadata?.title || 'Unknown'} (${item.metadata?.source || 'unknown source'})`);
        console.log(`Relevance: ${Math.round(item.score * 100)}%`);
        console.log('-');
        // Print a snippet of the content
        console.log(item.content.substring(0, 200) + (item.content.length > 200 ? '...' : ''));
      });
      console.log('----------------------------------');
    }
    
    // If error, print it
    if (!responseData.success && responseData.error) {
      console.error('\nError:', responseData.error);
    }
  } catch (error) {
    console.error('Error running test:', error);
  }
}

// Show help if requested
if (args.includes('--help')) {
  console.log(`
Question Answering Agent Test Script

Usage:
  node test-qa-agent.js [question] [document_type] [options]

Arguments:
  question         The question to ask (default: "What are our company's core competencies?")
  document_type    Type of documents to search in: 'company', 'source', or 'all' (default: all)

Options:
  --context        Include the context used to answer the question
  --limit N        Number of documents to retrieve (default: 5)
  --help           Show this help message

Examples:
  node test-qa-agent.js "What services do we offer?" company
  node test-qa-agent.js "What are the tender requirements?" source --context
  node test-qa-agent.js "Who are our key personnel?" all --limit 10
  `);
  process.exit(0);
}

// Run the test
testQuestionAnsweringAgent()
  .then(() => {
    console.log('\nTest completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nTest failed:', error);
    process.exit(1);
  }); 