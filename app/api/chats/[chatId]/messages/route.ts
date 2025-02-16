import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type MessageInput = {
  role: 'user' | 'assistant';
  content: string;
  type?: string;
  fileDetails?: {
    name: string;
    url: string;
    contentType?: string;
  } | null;
};

export async function POST(
  req: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { messages } = await req.json();
    const chatId = params.chatId;

    // Verify chat exists
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: true
      }
    });

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Create all messages in a transaction
    const messagePromises = messages.map((message: MessageInput) => {
      const messageData = {
        content: message.content,
        role: message.role,
        type: message.type || 'text',
        fileDetails: message.fileDetails ? JSON.stringify(message.fileDetails) : null,
        chatId: chatId
      };
      return prisma.message.create({
        data: messageData
      });
    });

    const createdMessages = await prisma.$transaction(messagePromises);

    // Update chat title if this is the first user message
    if (chat.messages.length === 0 && messages.some((m: MessageInput) => m.role === 'user')) {
      const firstUserMessage = messages.find((m: MessageInput) => m.role === 'user');
      if (firstUserMessage) {
        const title = firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
        await prisma.chat.update({
          where: { id: chatId },
          data: { title }
        });
      }
    }

    return NextResponse.json(createdMessages);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create messages' },
      { status: 500 }
    );
  }
} 