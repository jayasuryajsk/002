import { google } from "@ai-sdk/google"
import { generateText } from "ai"
import { Message } from "ai"
import { NextResponse } from "next/server"

export const runtime = "edge"

export async function POST(req: Request) {
  try {
    const { messages, pdfContent } = await req.json()
    
    // Get the last message content
    const lastMessage = messages[messages.length - 1]
    let content: string | Array<{ type: string; text?: string; data?: Uint8Array; mimeType?: string }> = 
      lastMessage.content

    // If there's PDF content, include it with the last text message
    if (pdfContent) {
      // Find the last text message (should be right before the PDF message)
      const lastTextMessage = messages[messages.length - 2]
      content = [
        { type: "text", text: lastTextMessage.content },
        { type: "file", data: new Uint8Array(pdfContent), mimeType: "application/pdf" }
      ]
    }

    const response = await generateText({
      model: google("gemini-2.0-flash-001"),
      messages: [
        ...messages.slice(0, -1),
        {
          role: "user",
          content
        }
      ]
    })

    // Stream the response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(response.text)}\n\n`))
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  } catch (error) {
    console.error("Chat error:", error)
    return new NextResponse("Error processing chat request", { status: 500 })
  }
}

