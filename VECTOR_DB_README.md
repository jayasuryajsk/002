# Vector Database Integration for Tender Generation

This integration adds vector database support to the tender generation system using Pinecone, enabling semantic search and more relevant document retrieval for improved AI-generated tenders.

## Features

- **Vector Embeddings**: Store document chunks as embeddings for semantic similarity search
- **Pinecone Integration**: Cloud-hosted vector database with scalable performance
- **Intelligent Chunking**: Documents are split into semantic chunks for more precise retrieval
- **Production Ready**: Enterprise-grade vector search with minimal setup

## Setup Instructions

### 1. Environment Configuration

Configure the Pinecone vector database by updating `.env.local`:

```env
# API Keys
GOOGLE_API_KEY=your-google-api-key
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=your-pinecone-environment

# Pinecone Configuration
PINECONE_INDEX_NAME=tender-documents
```

### 2. Pinecone Setup

1. Create a [Pinecone account](https://www.pinecone.io/)
2. Create a new index with:
   - Dimensions: 768 (for Google's embedding-001 model)
   - Metric: Cosine
   - Pod Type: Start with p1 or s1 (increase based on volume)
3. Copy your API key and environment details to `.env.local`

## Usage

The vector database is automatically utilized in the tender generation process:

1. **Document Indexing**: When documents are added or loaded, they are automatically:
   - Split into semantic chunks
   - Converted to embeddings
   - Stored in Pinecone

2. **Semantic Search**: When generating a tender, the system will:
   - Convert the prompt to an embedding
   - Find the most relevant document chunks
   - Prioritize those chunks in the context provided to the AI

## API Changes

No external API changes were made. The system automatically utilizes the vector database behind the scenes.

## Monitoring and Maintenance

- Logs show which chunks are being retrieved for each query
- Performance metrics are included in the API response metadata
- Use the Pinecone dashboard to monitor usage and performance

## Troubleshooting

**Common issues:**

1. **Missing embeddings**: Ensure your Google API key has access to the embedding model
2. **Pinecone connection errors**: Check your API key and environment settings
3. **Slow performance**: Consider increasing your Pinecone pod size or switching to a different pod type

## Future Improvements

- Multi-query retrieval for more diverse document selection
- Hybrid search combining vector and keyword approaches
- User feedback loop to refine retrieval quality 