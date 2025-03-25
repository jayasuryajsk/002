// Script to test the question asking agent
require('dotenv').config();
const { QuestionAskingAgent } = require('../lib/agents/question-asking-agent');

// Command line arguments
const args = process.argv.slice(2);
const topic = args[0] || "company capabilities and expertise";
const documentType = args[1] || "all"; // 'company', 'source', or 'all'
const questionCount = args.includes('--count') 
  ? parseInt(args[args.indexOf('--count') + 1]) 
  : 5;
const noAnswers = args.includes('--no-answers');

/**
 * Run a test with the question asking agent
 */
async function testQuestionAskingAgent() {
  console.log(`Topic: "${topic}"`);
  console.log(`Document type: ${documentType}`);
  console.log(`Question count: ${questionCount}`);
  console.log(`Get answers: ${!noAnswers}`);
  console.log('\nGenerating questions...\n');
  
  // Initialize the agent
  const askingAgent = new QuestionAskingAgent();
  
  // Format the request
  const request = {
    role: "orchestrator",
    content: JSON.stringify({
      topic,
      documentType,
      questionCount,
      getAnswers: !noAnswers
    })
  };
  
  try {
    // Get the response
    const startTime = Date.now();
    const response = await askingAgent.processMessage(request);
    const endTime = Date.now();
    
    // Parse the response
    const responseData = JSON.parse(response.content);
    
    // Print the results
    if (responseData.success) {
      console.log('------------- QUESTIONS -------------');
      responseData.questions.forEach((question, index) => {
        console.log(`[${index + 1}] ${question}`);
      });
      console.log('------------------------------------');
      
      if (responseData.answers && responseData.answers.length > 0) {
        console.log('\n------------- ANSWERS -------------');
        responseData.answers.forEach((item, index) => {
          console.log(`\n[Question ${index + 1}] ${item.question}`);
          console.log(`[Answer] ${item.answer}`);
          console.log('---');
        });
        console.log('------------------------------------');
      }
    } else {
      console.error('Error:', responseData.error);
    }
    
    // Print metadata
    console.log(`\nResponse time: ${(endTime - startTime) / 1000} seconds`);
    console.log(`Generated ${responseData.questions?.length || 0} questions`);
    console.log(`Retrieved ${responseData.answers?.length || 0} answers`);
    
  } catch (error) {
    console.error('Error running test:', error);
  }
}

// Show help if requested
if (args.includes('--help')) {
  console.log(`
Question Asking Agent Test Script

Usage:
  node test-question-asking.js [topic] [document_type] [options]

Arguments:
  topic            The topic to generate questions about (default: "company capabilities and expertise")
  document_type    Type of documents to search in: 'company', 'source', or 'all' (default: all)

Options:
  --count N        Number of questions to generate (default: 5)
  --no-answers     Don't retrieve answers to the generated questions
  --help           Show this help message

Examples:
  node test-question-asking.js "tender requirements" source
  node test-question-asking.js "past project experience" company --count 10
  node test-question-asking.js "team qualifications" all --no-answers
  `);
  process.exit(0);
}

// Run the test
testQuestionAskingAgent()
  .then(() => {
    console.log('\nTest completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nTest failed:', error);
    process.exit(1);
  }); 