import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  req: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { messages } = await req.json();
    const chatId = params.chatId;

    // Verify chat exists
    const chat = await prisma.chat.findUnique({
      where: { id: chatId }
    });

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Create all messages in a transaction
    const createdMessages = await prisma.$transaction(
      messages.map((message: any) => 
        prisma.message.create({
          data: {
            content: message.content,
            role: message.role,
            chatId: chatId
          }
        })
      )
    );

    return NextResponse.json(createdMessages);
  } catch (error) {
    console.error('Error creating messages:', error);
    return NextResponse.json(
      { error: 'Failed to create messages' },
      { status: 500 }
    );
  }
} 