# Tool-Based Architecture for Tender Generation

This document explains the new tool-based architecture for the tender generation system. This approach maintains the specialized Pinecone agents while introducing flexible tools that can be used by any agent.

## Tools vs. Agents

### Traditional Agent Architecture (Current System)
- Multiple specialized agents (PineconeSearchAgent, QuestionAnsweringAgent, etc.)
- Agents pass messages to each other through an orchestrator
- Each agent has specific capabilities
- Processing flow requires coordinating between many agents

### Tool-Based Architecture (New System)
- Fewer agents with access to a rich set of tools
- Tools encapsulate specific functionalities (search, question answering, etc.)
- Tools are called directly by agents when needed
- More flexible and modular approach

## Implemented Tools

We've implemented several Pinecone-based tools:

1. **Search Tool**
   - Searches Pinecone for relevant documents
   - Can be filtered by document type (company/source/all)
   
2. **Answer Tool**
   - Answers questions using documents from Pinecone
   - Returns both the answer and source information
   
3. **Extract Requirements Tool**
   - Extracts requirements from source documents
   - Identifies explicit and implicit requirements
   
4. **Generate Section Tool**
   - Creates full tender sections based on information from documents
   - Automatically incorporates requirements

## Using the Tools

There are two ways to use the tools:

### 1. Directly via the Tool Manager

```javascript
const { defaultToolManager } = require('../lib/tools/tool-manager');
const { searchTool } = require('../lib/tools/pinecone-tools');

// Register the tool
defaultToolManager.registerTool(searchTool);

// Execute the tool
const result = await defaultToolManager.executeTool('search', {
  query: 'company capabilities',
  documentType: 'company',
  limit: 5
});

console.log(`Found ${result.count} documents`);
```

### 2. Via the ToolUsingAgent

```javascript
const { ToolUsingAgent } = require('../lib/agents/tool-using-agent');
const { pineconeTools } = require('../lib/tools/pinecone-tools');

// Create agent and register tools
const agent = new ToolUsingAgent();
agent.registerTools(pineconeTools);

// Send a request
const response = await agent.processMessage({
  role: 'user',
  content: 'What are our core capabilities?'
});

console.log(response.content);
```

## Testing Tools

You can test the tool-based approach using the included script:

```bash
# Test with default query
node scripts/test-tool-agent.js

# Test with custom query
node scripts/test-tool-agent.js "Create a technical approach section for the bid"

# Show more details
node scripts/test-tool-agent.js --verbose
```

## How It Works

1. The ToolUsingAgent parses the user's request
2. It generates a plan of which tools to use
3. It executes each tool in the plan
4. It synthesizes a final response using tool results

Example plan:
```
1. Use 'search' tool with query="company capabilities" and documentType="company"
2. Use 'extract_requirements' tool with topic="technical requirements" and documentType="source"
3. Use 'answer_question' tool with question="How do our capabilities match the requirements?"
```

## Benefits of the Tool Approach

1. **Simplified Architecture**: Fewer agents to coordinate
2. **Greater Flexibility**: Tools can be mixed and matched
3. **Easier Extension**: Add new capabilities by creating new tools
4. **Better Task Planning**: Agents can plan which tools to use
5. **Improved Reusability**: Tools can be shared across different agents

## Next Steps

1. Convert more agent functionality to tools
2. Create domain-specific tools for tender generation
3. Implement tools for document submission and formatting
4. Add tool versioning and dependency management
5. Create a UI for visualizing tool execution 