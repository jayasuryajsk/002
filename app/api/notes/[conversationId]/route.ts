import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { Note as PrismaNote } from ".prisma/client"

export async function GET(
  request: Request,
  { params }: { params: { conversationId: string } }
) {
  try {
    const notes = await prisma.note.findMany({
      where: {
        conversationId: params.conversationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      notes: notes.map((note: PrismaNote) => ({
        id: note.id,
        content: note.content,
        timestamp: note.createdAt.toISOString(),
        category: note.category,
        tags: note.tags,
        source: {
          type: 'conversation' as const,
          messageId: note.messageId,
        },
      })),
    })
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    )
  }
} 