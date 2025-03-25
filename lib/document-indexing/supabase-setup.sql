-- Enable the vector extension (run once)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the documents table with vector support
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  content TEXT,
  metadata JSONB,
  embedding VECTOR(1536)
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create a function to match documents based on embedding similarity
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Create a function to enable the vector extension
CREATE OR REPLACE FUNCTION enable_vectors()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
END;
$$;

-- Create a function to create the documents table
CREATE OR REPLACE FUNCTION create_documents_table()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create the documents table if it doesn't exist
  CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    content TEXT,
    metadata JSONB,
    embedding VECTOR(1536)
  );

  -- Create the index if it doesn't exist
  CREATE INDEX IF NOT EXISTS documents_embedding_idx 
  ON documents USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);
END;
$$;

-- Create a function to create the match_documents function
CREATE OR REPLACE FUNCTION create_match_documents_function()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create the match_documents function
  CREATE OR REPLACE FUNCTION match_documents(
    query_embedding VECTOR(1536),
    match_threshold FLOAT,
    match_count INT
  )
  RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
  )
  LANGUAGE plpgsql
  AS $func$
  BEGIN
    RETURN QUERY
    SELECT
      documents.id,
      documents.content,
      documents.metadata,
      1 - (documents.embedding <=> query_embedding) AS similarity
    FROM documents
    WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
  END;
  $func$;
END;
$$;

-- Create a function to create the enable_vectors function
CREATE OR REPLACE FUNCTION create_enable_vectors_function()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create the enable_vectors function
  CREATE OR REPLACE FUNCTION enable_vectors()
  RETURNS VOID
  LANGUAGE plpgsql
  AS $func$
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  END;
  $func$;
END;
$$;

-- Create a function to create the create_documents_table function
CREATE OR REPLACE FUNCTION create_create_documents_table_function()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create the create_documents_table function
  CREATE OR REPLACE FUNCTION create_documents_table()
  RETURNS VOID
  LANGUAGE plpgsql
  AS $func$
  BEGIN
    -- Create the documents table if it doesn't exist
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY,
      content TEXT,
      metadata JSONB,
      embedding VECTOR(1536)
    );

    -- Create the index if it doesn't exist
    CREATE INDEX IF NOT EXISTS documents_embedding_idx 
    ON documents USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);
  END;
  $func$;
END;
$$; 