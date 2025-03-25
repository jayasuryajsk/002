import { PineconeOrchestrator } from '../../../lib/agents/pinecone-orchestrator';

// Initialize a global orchestrator - will be reused across requests
const orchestratorPromise = (async () => {
  try {
    const { PineconeOrchestrator } = await import('../../../lib/agents/pinecone-orchestrator');
    return new PineconeOrchestrator();
  } catch (error) {
    console.error('Error initializing PineconeOrchestrator:', error);
    throw error;
  }
})();

export const config = {
  runtime: 'edge',
  maxDuration: 300, // 5 minutes
};

export default async function handler(req) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get the orchestrator (initialized on first request)
    const orchestrator = await orchestratorPromise;
    
    // Parse the request body
    const requestData = await req.json();
    
    // Extract the generation options
    const { 
      title = 'Tender Document',
      sections = [],
      companyContext,
      additionalContext
    } = requestData;

    // Validate input
    if (!Array.isArray(sections) || sections.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one section must be provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Stream response with a TransformStream
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start async generation
    (async () => {
      try {
        // Send initial response
        await writer.write(encoder.encode(`# ${title}\n\nGenerating tender document...\n\n`));

        // Generate each section and stream it
        for (const section of sections) {
          await writer.write(encoder.encode(`## ${section.title}\n\nProcessing...\n\n`));
        }

        // Generate the tender document
        const result = await orchestrator.generateTender({
          title,
          sections,
          companyContext,
          additionalContext
        });

        if (!result.success || !result.tender) {
          await writer.write(encoder.encode(`\n\n## Error\n\n${result.message || 'Failed to generate tender document.'}\n`));
        } else {
          // Stream each generated section
          for (const section of result.tender.sections) {
            await writer.write(encoder.encode(`## ${section.title}\n\n${section.content}\n\n`));
          }

          // Add footer
          await writer.write(encoder.encode('\n\n---\n\nTender document generated using Pinecone vector search and AI agents.\n'));
        }
      } catch (error) {
        console.error('Error generating tender:', error);
        await writer.write(encoder.encode(`\n\n## Error\n\n${error.message || 'An unexpected error occurred.'}\n`));
      } finally {
        writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in generate-with-pinecone handler:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 