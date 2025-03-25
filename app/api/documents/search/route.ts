import { NextResponse } from "next/server";
import { generateEmbeddings } from "../../../../lib/document-indexing/processor";
import { supabase } from "../../../../lib/document-indexing/supabase";

// Define the document result interface
interface DocumentResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
  [key: string]: any; // Add index signature to allow string indexing
}

export async function POST(req: Request) {
  try {
    const { 
      query, 
      filters = {}, 
      limit = 5,
      threshold = 0.7,
      includeMetadata = true,
      groupByDocument = false 
    } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbeddings(query);
    
    // Set match threshold and count
    const matchThreshold = threshold;
    const matchCount = limit * 2; // Fetch more than needed to allow for filtering
    
    // Call the match_documents function
    let { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount
    });
    
    if (error) {
      console.error('Search error:', error);
      return NextResponse.json({ error: "Search failed", details: error.message }, { status: 500 });
    }
    
    // Apply additional filters if provided
    if (data && Object.keys(filters).length > 0) {
      data = data.filter((item: DocumentResult) => {
        // Check each filter condition
        for (const [key, value] of Object.entries(filters)) {
          // Handle nested metadata properties with dot notation (e.g., "metadata.docType")
          if (key.includes('.')) {
            const [parent, child] = key.split('.');
            if (parent === 'metadata' && item.metadata) {
              if (item.metadata[child] !== value) {
                return false;
              }
            }
          } 
          // Handle direct properties
          else if (item[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }
    
    // Group by document if requested
    let results = data || [];
    if (groupByDocument && results.length > 0) {
      const documentGroups: Record<string, any> = {};
      
      // Group chunks by parent document
      results.forEach((item: DocumentResult) => {
        const parentId = item.metadata?.parent_id || item.id.split('_chunk_')[0];
        
        if (!documentGroups[parentId]) {
          documentGroups[parentId] = {
            id: parentId,
            title: item.metadata?.title || item.metadata?.fileName || 'Untitled Document',
            chunks: [],
            maxSimilarity: 0,
            metadata: item.metadata
          };
        }
        
        // Add chunk to document group
        documentGroups[parentId].chunks.push({
          id: item.id,
          content: item.content,
          similarity: item.similarity
        });
        
        // Update max similarity score
        if (item.similarity > documentGroups[parentId].maxSimilarity) {
          documentGroups[parentId].maxSimilarity = item.similarity;
        }
      });
      
      // Convert to array and sort by max similarity
      results = Object.values(documentGroups)
        .sort((a, b) => b.maxSimilarity - a.maxSimilarity)
        .slice(0, limit);
    } else {
      // Take only up to limit results after filtering
      results = results.slice(0, limit);
    }
    
    // Format the results
    const formattedResults = results.map((item: any) => {
      const result: Record<string, any> = {
        id: item.id,
        content: item.content,
        score: item.similarity || item.maxSimilarity
      };
      
      // Include metadata if requested
      if (includeMetadata) {
        result.metadata = item.metadata;
      }
      
      // Include chunks if grouped by document
      if (groupByDocument && item.chunks) {
        result.chunks = item.chunks;
      }
      
      return result;
    });
    
    return NextResponse.json({ 
      results: formattedResults,
      query,
      count: formattedResults.length,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      groupedByDocument: groupByDocument
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ 
      error: "Search failed",
      details: (error as Error).message
    }, { status: 500 });
  }
}