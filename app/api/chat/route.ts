import { Message } from 'ai'
import { NextResponse } from "next/server"
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

export const runtime = "edge"

// Function to create a streaming response
function createStreamingResponse(stream: AsyncIterable<string>) {
  const encoder = new TextEncoder();
  
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // Format as SSE
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
          // Send end marker
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          const errorMessage = `An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      }
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }
  );
}

// Define a custom message type that includes the type field we need
interface ChatMessage extends Message {
  type?: string;
  selectedText?: string;
  selectionInfo?: {
    lines?: string;
    context?: string;
    startLine?: number;
    endLine?: number;
  };
  content: any; // Can be string or multimodal array
}

// Define a file data interface
interface FileData {
  type: 'file';
  data: number[];
  mimeType: string;
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    // Get the last message content
    const lastMessage: ChatMessage = messages[messages.length - 1]
    let content = lastMessage.content
    
    // Check if content is an array (multimodal)
    const isMultimodal = Array.isArray(content)
    
    // Prepare system message
    const systemMessage = messages.find((m: ChatMessage) => m.role === "system")?.content || 
      "You are an expert assistant specialized in document processing and tender generation."
    
    // Check if this is a selected text message
    if (lastMessage.type === "selected-text" && lastMessage.selectedText) {
      // Get line information if available
      const lineInfo = lastMessage.selectionInfo?.startLine && lastMessage.selectionInfo?.endLine
        ? `Lines ${lastMessage.selectionInfo.startLine}-${lastMessage.selectionInfo.endLine}`
        : "Selected text";
        
      // Format a more specific prompt that includes the selected text
      content = `I'm looking at ${lineInfo} from my document:
      
"${lastMessage.selectedText}"

My question/request about this text: ${content}

If this is a request to edit or improve this text, provide only the exact replacement text with no additional explanations, no "Option 1/2/3" prefixes, and no surrounding quotes. Just respond with a single version of the improved text that I can directly use as a replacement.`
    }

    // Use environment variables for API key
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set');
    }
    
    // Create provider with the Vercel AI SDK
    const provider = createGoogleGenerativeAI({
      apiKey: apiKey,
    });

    // Handle file uploads with multimodal content
    if (isMultimodal) {
      try {
        console.log("Processing multimodal content with files");
        
        // Transform content array into message format
        const aiMessages: {role: 'system' | 'user' | 'assistant', content: any}[] = [];
        
        // Add system message if available
        if (systemMessage) {
          aiMessages.push({
            role: 'system' as const,
            content: systemMessage,
          });
        }
        
        // Add the multimodal content
        aiMessages.push({
          role: 'user' as const,
          content: content.map((part: any) => {
            if (part.type === 'text') {
              return { type: 'text', text: part.text };
            } else if (part.type === 'file') {
              // Convert numeric array back to Buffer for file data
              const fileData = part as FileData;
              const buffer = Buffer.from(fileData.data);
              
              return {
                type: 'file',
                data: buffer,
                mimeType: fileData.mimeType
              };
            }
            return part;
          }),
        });
        
        // Generate content with the model
        const model = provider('gemini-2.0-flash-001');
        const streamGenerator = async function*() {
          try {
            // Call the model with the messages
            const result = await generateText({
              model: model,
              messages: aiMessages
            });
            
            // Yield the response text
            yield result.text;
          } catch (error) {
            console.error("Error generating content:", error);
            yield "An error occurred while processing your request.";
          }
        };
        
        // Stream the response
        return createStreamingResponse(streamGenerator());
      } catch (error) {
        console.error("Error processing multimodal content:", error);
        return new Response(
          JSON.stringify({ error: "Failed to process file content" }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // For regular text chat, use the simplified approach
    const aiMessages: {role: 'system' | 'user' | 'assistant', content: any}[] = [];
    
    // Add system message if available
    if (systemMessage) {
      aiMessages.push({
        role: 'system' as const,
        content: systemMessage,
      });
    }
    
    // Add user message
    aiMessages.push({
      role: 'user' as const,
      content: typeof content === 'string' ? content : JSON.stringify(content),
    });
    
    // Generate content with the model
    const model = provider('gemini-2.0-flash-001');
    const streamGenerator = async function*() {
      try {
        // Call the model with the messages
        const result = await generateText({
          model: model,
          messages: aiMessages
        });
        
        // Yield the response text
        yield result.text;
      } catch (error) {
        console.error("Error generating content:", error);
        yield "An error occurred while processing your request.";
      }
    };
    
    // Stream the response
    return createStreamingResponse(streamGenerator());
  } catch (error) {
    console.error("Error in chat:", error);
    return new NextResponse(
      JSON.stringify({ error: "An error occurred during chat" }),
      { status: 500 }
    );
  }
}
