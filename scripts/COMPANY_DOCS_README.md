# Company Documents Indexing for Tender Generation

This utility allows you to index your company documents into Pinecone, making them available as context for AI-generated tenders.

## Overview

The company documents indexing workflow:

1. Company documents are stored in `local-storage/company-docs/`
2. Documents are processed and chunked into smaller pieces
3. Each chunk is converted to an embedding (vector representation)
4. Embeddings are stored in Pinecone vector database
5. When generating tenders, relevant company docs are retrieved

## Setup Requirements

Before using this script, ensure you have:

1. A Pinecone account and API key
2. A Google API key with access to the embeddings model
3. The following environment variables set in `.env.local`:

```
GOOGLE_API_KEY=your-google-api-key
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=tender-documents (or your preferred index name)
```

## Usage

### Adding and Indexing a Single Document

To add a company document and immediately index it:

```bash
node scripts/index-company-docs.js path/to/your/document.txt "Document Title"
```

- The first argument is the path to your document file
- The second argument (optional) is the title of the document

### Indexing All Documents

To index all existing company documents:

```bash
node scripts/index-company-docs.js
```

### Advanced Options

The script supports several options:

```bash
node scripts/index-company-docs.js [options] [file] [title]

Options:
  --help              Show help message
  --force             Force reindexing all documents
  --skip-embeddings   Skip embedding generation (for testing)
  --skip-pinecone     Skip Pinecone storage (for testing)
  --verbose           Show more detailed logs
```

## Document Storage Structure

Company documents are stored in the `local-storage/company-docs/` directory with the following structure:

- `{id}-metadata.json`: Contains document metadata
- `{id}-content`: Contains the raw text content

The metadata JSON includes:
- Document ID
- Title
- Type (always "company" for company docs)
- Other metadata (file type, size, date added, etc.)

## Troubleshooting

Common issues:

1. **Missing API Keys**: Ensure both `GOOGLE_API_KEY` and `PINECONE_API_KEY` are set in your environment variables.

2. **Index Creation Failure**: If the Pinecone index creation fails, check your Pinecone account permissions and limits.

3. **Embedding Generation Errors**: If embedding generation fails, verify your Google API key has access to the embedding-001 model.

4. **Permission Issues**: If you encounter file system permission issues, ensure your process has write access to the `local-storage` directory.

For testing purposes, you can use the `--skip-embeddings` and `--skip-pinecone` flags to isolate different parts of the workflow.

## FAQ

**Q: What file formats are supported?**
A: Currently, the script best supports text files. PDF and DOCX support requires additional configuration.

**Q: How many documents can I index?**
A: This depends on your Pinecone tier. The free tier supports up to 100,000 vectors, which is typically enough for several hundred pages of text.

**Q: How are documents chunked?**
A: Documents are split into chunks of approximately 1000 characters with 200 character overlap, trying to respect paragraph and sentence boundaries. 