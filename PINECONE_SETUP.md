# Pinecone Setup Guide

This guide walks you through setting up Pinecone as your vector database for the tender generation system.

## 1. Create a Pinecone Account

1. Go to [https://www.pinecone.io/](https://www.pinecone.io/) and sign up for an account
2. Verify your email address

## 2. Create an API Key

1. From your Pinecone dashboard, navigate to "API Keys"
2. Click "Create API Key"
3. Give your key a name (e.g., "Tender-Generator")
4. Copy the API key for use in your application

## 3. Create a Pinecone Index

1. In the Pinecone dashboard, navigate to "Indexes"
2. Click "Create Index"
3. Configure your index:
   - **Name**: `tender-documents` (or your preferred name)
   - **Dimensions**: 768 (this matches Google's embedding-001 model)
   - **Metric**: Cosine similarity
   - **Pod Type**: Choose based on your needs:
     - **Serverless**: Good for getting started, scales automatically
     - **S1**: Lower cost, good for development
     - **P1**: Better performance, suitable for production
   - **Cloud Provider/Region**: Choose one close to your application deployment

4. Click "Create Index"
5. Wait for the index to initialize (this may take a few minutes)

## 4. Configure Your Application

Update your `.env.local` file with the following:

```env
# Pinecone Configuration
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=tender-documents
VECTOR_DB=pinecone
```

Replace `your-pinecone-api-key` with the API key you created earlier.

## 5. Understanding Pinecone Costs

Pinecone pricing is based on the following factors:

- **Pod Type**: Serverless, S1, P1, P2, etc.
- **Vector Count**: Number of embeddings stored
- **Queries per Second (QPS)**: How frequently you search the database

For the tender generation system:

- A typical document might create 5-20 vectors (chunks)
- Each vector requires 768 dimensions × 4 bytes = ~3KB of storage
- 1,000 documents might create ~10,000-20,000 vectors (~30-60MB)

Pinecone's serverless tier charges based on actual usage, making it suitable for getting started.

## 6. Test Your Setup

After configuring your application, you can test your Pinecone setup:

1. Upload a document through your application
2. Check the logs to ensure it's being indexed in Pinecone
3. Try generating a tender to verify semantic search is working

## 7. Monitoring & Maintenance

1. Use the Pinecone dashboard to monitor:
   - Vector count
   - Index size
   - Query performance

2. Consider implementing a scheduled task to:
   - Remove old or unused vectors
   - Re-index documents with improved chunking strategies
   - Monitor embedding quality over time

## Troubleshooting

- **Connection Issues**: Verify your API key and check network connectivity
- **Query Returns No Results**: Check that documents were successfully indexed
- **Slow Performance**: Consider upgrading your pod type or optimizing your queries

## Security Considerations

- Keep your Pinecone API key secure
- Consider using environment variables or a secret manager
- The API key has full access to all your indexes, so protect it carefully 