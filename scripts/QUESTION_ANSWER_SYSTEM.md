# Q&A System for Tender Generation

This system provides a sophisticated question-answering capability for the tender generation process, allowing agents to extract information from both company documents and source documents stored in Pinecone.

## Overview

The Q&A system consists of two main components:

1. **Question Answering Agent** - Takes a question and retrieves relevant information from Pinecone
2. **Question Asking Agent** - Generates insightful questions to extract information about specific topics

Together, these agents enable an interactive information extraction process similar to how Cursor interacts with an indexed codebase.

## Key Features

- **Document-Type Specific Retrieval**: Specify whether to search in company documents, source documents, or both
- **High-Quality Answers**: Uses RAG (Retrieval Augmented Generation) with the Gemini model
- **Topic-Based Question Generation**: Automatically generate insightful questions for a given topic
- **API First Design**: Both agents expose clean APIs for integration with the main tender generation process

## Usage

### Direct Question Answering

To directly ask a question and get an answer:

```bash
node scripts/test-qa-agent.js "What services does our company offer?" company
```

This will:
1. Search for relevant documents in Pinecone
2. Extract the most relevant information
3. Generate a concise answer based on the found information

Options:
- Specify document type: `company`, `source`, or `all` (default)
- Include context with `--context`
- Control result limit with `--limit N`

### Topic-Based Question Generation

To generate insightful questions about a topic:

```bash
node scripts/test-question-asking.js "tender requirements" source
```

This will:
1. Generate relevant questions about the specified topic
2. Search for answers to each question
3. Return both questions and answers

Options:
- Specify document type: `company`, `source`, or `all` (default)
- Control question count with `--count N`
- Skip answer retrieval with `--no-answers`

## Integration with Tender Generation

The Q&A system is designed to be integrated with the main tender generation process, allowing:

1. **Main Agent Understanding**: The main agent can use these tools to better understand the tender task
2. **Subagent Information Retrieval**: Subagents can use Q&A to extract specific information needed for their sections
3. **Iterative Exploration**: Agents can explore topics by generating questions and getting answers

## Example Workflow

1. User uploads source documents (RFP, requirements, etc.)
2. Source documents are indexed locally (not in Pinecone)
3. Main agent reads source documents to understand the tender task
4. Main agent uses Q&A to extract specific information about company capabilities
5. Main agent plans and delegates to subagents
6. Subagents use Q&A to extract relevant information for their sections
7. Final tender is generated based on all collected information

## Technical Details

Both agents leverage:
- Pinecone for vector storage and semantic search
- Google's Gemini model for answering and question generation
- LangChain for document loading and processing

## Future Improvements

- Add memory to maintain conversation context
- Support for multi-turn conversations
- Filter results by metadata (date, document type, etc.)
- Confidence scoring for answers 