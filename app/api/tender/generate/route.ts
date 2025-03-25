import { NextRequest, NextResponse } from 'next/server';
import { TenderOrchestrator } from '@/lib/agents/core/tender-orchestrator';
import fs from 'fs';
import path from 'path';

// Helper function to read API keys directly from .env file
function getDirectEnvValue(key: string): string | null {
  try {
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(new RegExp(`${key}=([^\\r\\n]+)`));
    return match ? match[1] : null;
  } catch (error) {
    console.error(`Error reading ${key} from .env file:`, error);
    return null;
  }
}

// Initialize a global orchestrator instance
let orchestratorInstance: TenderOrchestrator | null = null;

async function getOrchestrator(): Promise<TenderOrchestrator> {
  if (!orchestratorInstance) {
    orchestratorInstance = new TenderOrchestrator();
  }
  return orchestratorInstance;
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { message: "Tender generation API is available. Use POST to generate a tender document." },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  console.log('Tender Generation API: POST request received');
  
  try {
    // Parse the request body
    const requestData = await request.json();
    console.log('Request data received:', requestData);
    
    // Extract the generation options
    const { 
      prompt,
      sectionCount = 0,
      hasPrompt = false,
      hasCompanyContext = true,
      hasAdditionalContext = false,
      companyContext,
      additionalContext
    } = requestData;

    // Get the orchestrator
    const orchestrator = await getOrchestrator();
    
    // Load company context from storage if not explicitly provided
    let companyContextData = companyContext;
    if (hasCompanyContext && !companyContextData) {
      try {
        // Import local storage dynamically to avoid server/client issues
        const { LocalDocumentStorage } = await import('@/lib/local-storage');
        const companyDocs = await LocalDocumentStorage.getCompanyDocuments();
        
        if (companyDocs.length > 0) {
          // Don't combine all documents - instead, create a summary
          console.log(`Found ${companyDocs.length} company documents for context`);

          // Create a summary of the company documents instead of raw content
          const docSummaries = companyDocs.map(doc => {
            const title = doc.title || 'Untitled Document';
            // Take only first 200 chars of content to avoid token limits
            const preview = doc.content 
              ? (doc.content.length > 200 
                ? doc.content.substring(0, 200) + '...' 
                : doc.content)
              : 'Binary document';
              
            return `- ${title}: ${preview}`;
          }).join('\n\n');
          
          // Set a much more limited company context
          companyContextData = `Company has ${companyDocs.length} documents available for reference.\n\nDocument list:\n${docSummaries}`;
          console.log(`Created summarized company context (${companyContextData.length} chars)`);
        } else {
          console.log('No company documents found in storage');
        }
      } catch (error) {
        console.error('Error loading company documents:', error);
      }
    }

    // Create a ReadableStream for streaming the response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // Send initial response - don't include the initialization message in the final document
          controller.enqueue(encoder.encode(`<!-- PROGRESS_UPDATE: Initializing the tender generation process... -->\n`));
          
          // The actual content starts here - this should be rendered
          controller.enqueue(encoder.encode(`# Tender Document\n\n`));

          // Progress updates with more granular steps
          const progressUpdates = [
            { message: 'Analyzing source documents...', stage: 'Analyzing' },
            { message: 'Processing document content...', stage: 'Analyzing' },
            { message: 'Extracting key information...', stage: 'Planning' },
            { message: 'Creating document outline...', stage: 'Planning' },
            { message: 'Preparing section templates...', stage: 'Planning' },
            { message: 'Generating content...', stage: 'Writing' },
            { message: 'Reviewing content...', stage: 'Reviewing' },
            { message: 'Finalizing document...', stage: 'Finalizing' }
          ];
          
          // Stream progress updates as the generation progresses
          let progressIndex = 0;
          
          // Create a progress update function for the orchestrator
          const updateProgress = (message: string) => {
            // Use a special format for progress updates that the client can easily detect and filter
            controller.enqueue(encoder.encode(`<!-- PROGRESS_UPDATE: ${message} -->\n`));
          };

          // Start the tender generation process
          const result = await orchestrator.start({
            title: 'Tender Document',
            prompt: hasPrompt ? prompt : undefined,
            companyContext: hasCompanyContext ? companyContextData : undefined,
            additionalContext: hasAdditionalContext ? additionalContext : undefined,
            maxIterations: 2,
            onProgress: (message: string) => {
              // Send the progress update
              updateProgress(message);
              
              // If this is a section generation message, send additional progress info
              if (message.includes('Generating section')) {
                const match = message.match(/Generating section (\d+)\/(\d+)/);
                if (match) {
                  const [_, current, total] = match;
                  const progress = Math.round((parseInt(current) / parseInt(total)) * 100);
                  updateProgress(`Section Progress: ${progress}%`);
                }
              }
            }
          });

          if (!result.success || !result.tender) {
            controller.enqueue(encoder.encode(`\n\n## Error\n\n${result.message || 'Failed to generate tender document.'}\n`));
          } else {
            // Stream the tender title
            controller.enqueue(encoder.encode(`# ${result.tender.title}\n\n`));
            
            // Stream each generated section
            for (const section of result.tender.sections) {
              controller.enqueue(encoder.encode(`## ${section.title}\n\n${section.content}\n\n`));
              
              // If we have section requirements, add them
              if (section.requirements && section.requirements.length > 0) {
                controller.enqueue(encoder.encode(`### Requirements\n\n`));
                section.requirements.forEach((req, i) => {
                  controller.enqueue(encoder.encode(`${i+1}. ${req}\n`));
                });
                controller.enqueue(encoder.encode(`\n`));
              }
            }

            // Add generation stats if available
            if (result.stats) {
              controller.enqueue(encoder.encode(`\n\n---\n\n### Generation Statistics\n\n`));
              controller.enqueue(encoder.encode(`- Total Time: ${(result.stats.totalTime / 1000).toFixed(2)} seconds\n`));
              controller.enqueue(encoder.encode(`- Agent Calls: ${JSON.stringify(result.stats.agentCalls)}\n`));
              controller.enqueue(encoder.encode(`- Iterations: ${JSON.stringify(result.stats.iterations)}\n`));
            }
            
            // Send completion message
            updateProgress('Generation completed successfully');
            
            // Add footer
            controller.enqueue(encoder.encode('\n\n---\n\nTender document generated using multi-agent orchestration system.\n'));
          }
        } catch (error: any) {
          console.error('Error generating tender:', error);
          controller.enqueue(encoder.encode(`\n\n## Error\n\n${error.message || 'An unexpected error occurred.'}\n`));
        } finally {
          controller.close();
        }
      }
    });

    // Return the stream as a response
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Error in generate API handler:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
} 