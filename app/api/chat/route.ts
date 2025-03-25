import { Message } from 'ai'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

export const runtime = "edge"

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set');
}
const genAI = new GoogleGenerativeAI(apiKey)

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

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const model = genAI.getGenerativeModel({ 
          model: "gemini-2.0-flash-001",
          systemInstruction: systemMessage
        })
        
        try {
          // Handle multimodal content (with file data)
          if (isMultimodal) {
            try {
              console.log("Processing multimodal content with files")
              
              // Transform content array into Gemini multimodal format
              const parts = content.map((part: any) => {
                if (part.type === 'text') {
                  return { text: part.text }
                } else if (part.type === 'file') {
                  // Convert numeric array back to Buffer and then to base64
                  const fileData = part as FileData
                  const buffer = Buffer.from(fileData.data)
                  
                  return { 
                    inlineData: { 
                      mimeType: fileData.mimeType,
                      data: buffer.toString('base64')
                    } 
                  }
                }
                return part
              })
              
              console.log(`Sending ${parts.length} parts to Gemini`)
              
              // For multimodal content, use proper content format
              const result = await model.generateContentStream({
                contents: [{
                  role: "user",
                  parts
                }],
                generationConfig: {
                  temperature: 0.2,
                  topK: 32,
                  topP: 0.95,
                  maxOutputTokens: 8192,
                }
              });
              
              const encoder = new TextEncoder()
              
              for await (const chunk of result.stream) {
                const text = chunk.text()
                // Format as SSE
                const data = `data: ${JSON.stringify(text)}\n\n`
                controller.enqueue(encoder.encode(data))
              }
              
              // Send end marker
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
              return
            } catch (error) {
              console.error("Error processing multimodal content:", error)
              // Fallback to text-only if formatting fails
              content = "I received file content but was unable to process it properly. " + 
                        "Could you please upload it again? If this issue persists, you might need to " +
                        "summarize the key points you'd like me to address from the document."
            }
          }
          
          // For regular text chat, use the simplified approach
          const result = await model.generateContentStream([
            { text: typeof content === 'string' ? content : JSON.stringify(content) }
          ])
          
          const encoder = new TextEncoder()
          
          for await (const chunk of result.stream) {
            const text = chunk.text()
            // Format as SSE
            const data = `data: ${JSON.stringify(text)}\n\n`
            controller.enqueue(encoder.encode(data))
          }
          
          // Send end marker
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          
          controller.close()
        } catch (error: unknown) {
          console.error("Stream generation error:", error)
          const encoder = new TextEncoder()
          const errorMessage = `An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error("Error in chat:", error)
    return new NextResponse(
      JSON.stringify({ error: "An error occurred during chat" }),
      { status: 500 }
    )
  }
}
