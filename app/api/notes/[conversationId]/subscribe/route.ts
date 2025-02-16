import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import { onEvent } from "@/lib/events"

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { conversationId: string } }
) {
  const headersList = headers()
  
  // Set up SSE headers
  const responseHeaders = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const encoder = new TextEncoder()

  // Function to send SSE message
  const sendMessage = async (data: any) => {
    const message = `data: ${JSON.stringify(data)}\n\n`
    await writer.write(encoder.encode(message))
  }

  // Set up event listener for new notes
  const cleanup = onEvent('note.created', async (note) => {
    if (note.conversationId === params.conversationId) {
      await sendMessage(note)
    }
  })

  // Initial notes fetch
  try {
    const notes = await prisma.note.findMany({
      where: {
        conversationId: params.conversationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1,
    })

    if (notes.length > 0) {
      await sendMessage({
        id: notes[0].id,
        content: notes[0].content,
        timestamp: notes[0].createdAt.toISOString(),
        category: notes[0].category,
        tags: notes[0].tags,
      })
    }

    // Handle client disconnect
    request.signal.addEventListener('abort', () => {
      cleanup()
      writer.close()
    })

  } catch (error) {
    console.error('Error in SSE notes stream:', error)
    cleanup()
    await writer.close()
    return new Response('Error establishing SSE connection', { status: 500 })
  }

  return new Response(stream.readable, {
    headers: responseHeaders,
  })
} 