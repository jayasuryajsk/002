# Simple Document Indexing for Tender Generation

This guide explains how to easily index your company documents into Pinecone for use in tender generation.

## Quick Start

1. **Create a folder** for your documents (if none exists):
   ```
   mkdir docs-to-index
   ```

2. **Copy your documents** into the folder:
   - **Supports multiple formats:**
     - PDF files (.pdf)
     - Word documents (.doc, .docx)
     - Text files (.txt)
     - CSV files (.csv)
     - JSON files (.json)
   - Each file will be automatically processed
   - File names will be used as document titles

3. **Run the indexing script**:
   ```
   node scripts/index-folder-to-pinecone.js
   ```

4. **That's it!** Your documents will be:
   - Automatically loaded using LangChain document loaders
   - Processed and chunked intelligently
   - Converted to embeddings
   - Stored in Pinecone
   - Moved to a '_processed' subfolder

## How It Works

When you run the script:

1. It looks for all documents in the `docs-to-index` folder (default location)
2. LangChain's DirectoryLoader loads each file using the appropriate loader for its file type
3. Documents are split into semantic chunks using RecursiveCharacterTextSplitter
4. Each chunk is converted to an embedding and stored in Pinecone
5. Original files are moved to `docs-to-index/_processed` after successful processing
6. Document metadata and content are also stored locally in `local-storage/company-docs/`

## Options

You can customize the behavior:

```
node scripts/index-folder-to-pinecone.js [folder_path] [options]

Arguments:
  folder_path         Path to folder containing documents (default: ./docs-to-index)
                      Supports: PDF, DOCX, TXT, CSV, JSON files

Options:
  --verbose           Show more detailed logs
  --force             Force reindexing of all documents
  --help              Show help message
```

For example, to index documents from a different folder:
```
node scripts/index-folder-to-pinecone.js ./my-company-documents
```

## Using the Indexed Documents

Once your documents are indexed, generate tenders that use them:

```
node scripts/generate-tender-with-company-docs.js "IT Services Proposal"
```

The tender generation will automatically use your indexed company documents when creating content.

## Requirements

Make sure you have set up:

1. A Pinecone account and API key
2. A Google API key for embeddings
3. Environment variables in `.env` or `.env.local`:
   ```
   GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key
   PINECONE_API_KEY=your-pinecone-api-key
   PINECONE_INDEX_NAME=tender-documents
   ``` 