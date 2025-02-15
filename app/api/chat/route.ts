import { Message } from 'ai'
import { google } from "@ai-sdk/google"
import { streamText, createDataStreamResponse, smoothStream } from 'ai'
import { NextResponse } from "next/server"

export const runtime = "edge"

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

    // Build a new messages array that replaces the last message with our combined content
    const newMessages = [
      ...messages.slice(0, -1),
      { role: "user", content }
    ]

    // Return a streaming response using the native streaming helpers
    return createDataStreamResponse({
      execute: (dataStream) => {
        const result = streamText({
          model: google("gemini-2.0-flash-001"),
          messages: newMessages,
          experimental_transform: smoothStream({ chunking: 'word' })
        })

        // Merge the streaming result into the provided dataStream to force flush each chunk
        result.mergeIntoDataStream(dataStream)
      },
      onError: () => {
        return 'Oops, an error occurred while streaming.'
      }
    })
  } catch (error) {
    console.error("Error in chat:", error)
    return new NextResponse(
      JSON.stringify({ error: "An error occurred during chat" }),
      { status: 500 }
    )
  }
}
