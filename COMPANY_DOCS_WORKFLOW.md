# Company Documents for Tender Generation

This document explains how to set up and use company documents in the tender generation system. Leveraging your company documents in Pinecone allows for more personalized and accurate tender responses.

## Overview

The complete workflow consists of three main steps:

1. **Document Preparation**: Organizing your company documents
2. **Document Indexing**: Converting documents into vector embeddings in Pinecone
3. **Tender Generation**: Creating tenders that use company documents as context

## Prerequisites

Before you begin, make sure you have:

1. A Pinecone account and API key
2. A Google API key with access to the embeddings model and Gemini
3. The following environment variables configured in `.env` or `.env.local`:

```
GOOGLE_API_KEY=your-google-api-key
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=tender-documents
```

## Step 1: Document Preparation

Prepare your company documents in a format that can be indexed:

1. Text files (`.txt`) are easiest to work with
2. Documents should contain clear, well-structured information about your company
3. Examples of useful documents to include:
   - Company profile
   - Capability statements
   - Past project case studies
   - Team bios and qualifications
   - Technical methodologies
   - Quality assurance processes
   - Certifications and accreditations

Each document should be a separate file. Aim for focused documents rather than large, general files.

## Step 2: Document Indexing

Once you have your documents, you can index them with the provided script:

```bash
# Add a single document to the index
node scripts/index-company-docs.js path/to/your/document.txt "Document Title"

# Add multiple documents (run for each document)
node scripts/index-company-docs.js path/to/doc1.txt "First Document"
node scripts/index-company-docs.js path/to/doc2.txt "Second Document"

# Re-index all existing documents
node scripts/index-company-docs.js
```

The script will:
1. Add the document to local storage in `local-storage/company-docs/`
2. Chunk the document into smaller pieces
3. Generate embeddings for each chunk
4. Store the embeddings in Pinecone

For more indexing options, see the [Company Docs README](scripts/COMPANY_DOCS_README.md).

## Step 3: Tender Generation

With your company documents indexed, you can generate tenders that incorporate this information:

```bash
# Generate a tender using company documents
node scripts/generate-tender-with-company-docs.js "IT Services Proposal"

# Generate a tender without company documents
node scripts/generate-tender-with-company-docs.js "IT Services Proposal" --no-company-docs
```

The generated tender will be saved to the `output` directory in both JSON and Markdown formats.

## How It Works

### Document Storage

Company documents are stored with the following structure:
```
local-storage/
  company-docs/
    {uuid}-metadata.json  # Document metadata
    {uuid}-content        # Document text content
```

### Vector Embeddings

Each document is converted into vector embeddings using this process:
1. Document is split into chunks of ~1000 characters with overlap
2. Each chunk is converted to an embedding vector using Google's embedding-001 model
3. Embeddings are stored in Pinecone with company document metadata

### Tender Generation

When generating a tender with company documents:
1. For each section, the system searches for relevant company documents
2. The search uses semantic similarity to find the most relevant content
3. The retrieved documents are used as context for AI generation
4. The AI combines the tender requirements with your company information
5. This results in a personalized tender that incorporates your unique selling points

## Best Practices

For optimal results:

1. **Organize your documents** into clear, well-structured text
2. **Index a variety of materials** covering different aspects of your company
3. **Be specific in tender section titles** to match with relevant company information
4. **Check generated content** and refine your documents as needed
5. **Update your documents regularly** to reflect new capabilities or projects

## Troubleshooting

Common issues:

1. **No company documents found**: Make sure you've successfully indexed documents
2. **Poor quality tender sections**: Try adding more specific company documents
3. **Connection errors**: Check your API keys and internet connection
4. **Embedding errors**: Verify your Google API key has the necessary permissions
5. **Index not found**: Ensure your Pinecone index was created correctly

## Advanced Configuration

You can adjust several parameters for more control:

1. **Chunk size**: Modify the `chunkSize` parameter in the `chunkText` function
2. **Embedding model**: Change the model in `initializeEmbeddings` function
3. **Pinecone index settings**: Update the serverless configuration in `ensurePineconeIndex`

For complex needs, you may want to edit `lib/document-indexing/pinecone.ts` to customize the indexing process. 