import { NextResponse } from "next/server";
import { VectorSearchAgent } from "@/lib/agents/search/vector-search-agent";

export async function POST(req: Request) {
  try {
    const { 
      query, 
      operation = 'search',
      options = {},
      sectionTitle,
      documents
    } = await req.json();
    
    if (!query && operation === 'search') {
      return NextResponse.json({ error: "Query is required for search operation" }, { status: 400 });
    }
    
    const vectorSearchAgent = new VectorSearchAgent();
    
    // Handle different operations
    switch (operation) {
      case 'search':
        // Perform a semantic search
        const searchResults = await vectorSearchAgent.search(query, options);
        return NextResponse.json({ 
          results: searchResults,
          query,
          count: searchResults.length,
          operation
        });
        
      case 'summarize':
        // Validate documents are provided
        if (!documents || !Array.isArray(documents) || documents.length === 0) {
          return NextResponse.json({ 
            error: "Documents are required for summarize operation" 
          }, { status: 400 });
        }
        
        // Generate a summary of the provided documents
        const summary = await vectorSearchAgent.summarizeDocuments(documents, query || '');
        return NextResponse.json({ 
          summary,
          operation
        });
        
      case 'extract-requirements':
        // Validate documents are provided
        if (!documents || !Array.isArray(documents) || documents.length === 0) {
          return NextResponse.json({ 
            error: "Documents are required for extract-requirements operation" 
          }, { status: 400 });
        }
        
        // Extract requirements from the provided documents
        const requirements = await vectorSearchAgent.extractRequirements(documents);
        return NextResponse.json({ 
          requirements,
          count: requirements.length,
          operation
        });
        
      case 'generate-section':
        // Validate section title and documents are provided
        if (!sectionTitle) {
          return NextResponse.json({ 
            error: "Section title is required for generate-section operation" 
          }, { status: 400 });
        }
        
        if (!documents || !Array.isArray(documents) || documents.length === 0) {
          return NextResponse.json({ 
            error: "Documents are required for generate-section operation" 
          }, { status: 400 });
        }
        
        // Generate a tender section based on the provided documents
        const sectionContent = await vectorSearchAgent.generateTenderSection(sectionTitle, documents);
        return NextResponse.json({ 
          title: sectionTitle,
          content: sectionContent,
          operation
        });
        
      default:
        return NextResponse.json({ 
          error: `Unknown operation: ${operation}` 
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Vector search API error:", error);
    return NextResponse.json({ 
      error: "Operation failed",
      details: (error as Error).message
    }, { status: 500 });
  }
}
