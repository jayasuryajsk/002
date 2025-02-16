import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateNoteFromMessage } from "@/lib/note-service"

export async function POST(req: Request) {
  try {
    const { content, role, type = "text", fileDetails, chatId } = await req.json()

    const message = await prisma.message.create({
      data: {
        content,
        role,
        type,
        fileDetails,
        chatId
      }
    })

    // Trigger note generation in the background
    // We don't await this to keep the response fast
    generateNoteFromMessage(message).catch(console.error)

    return NextResponse.json(message)
  } catch (error) {
    console.error("Error creating message:", error)
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    )
  }
} 