import { Message } from 'ai'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

export const runtime = "edge"

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "")

export async function POST(req: Request) {
  try {
    const { messages, pdfContent } = await req.json()

    // Get the last message content (and include PDF content if provided)
    const lastMessage = messages[messages.length - 1]
    let content = lastMessage.content

    if (pdfContent) {
      // Use the last text message (before the PDF message) as the text part
      const lastTextMessage = messages[messages.length - 2]
      content = [
        { type: "text", text: lastTextMessage.content },
        { type: "file", data: new Uint8Array(pdfContent), mimeType: "application/pdf" }
      ]
    }

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" })
        
        try {
          const result = await model.generateContentStream([
            { text: content.toString() }
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
        } catch (error) {
          controller.error(error)
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
