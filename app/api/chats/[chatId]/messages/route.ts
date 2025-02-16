import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateNoteFromMessage } from '@/lib/note-service';

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
    console.log('Received message creation request for chat:', params.chatId);
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
      console.log('Chat not found:', chatId);
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    console.log('Creating messages:', messages.length);
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
    console.log('Messages created successfully:', createdMessages.map(m => m.id));

    // Update chat title if this is the first user message
    if (chat.messages.length === 0 && messages.some((m: MessageInput) => m.role === 'user')) {
      const firstUserMessage = messages.find((m: MessageInput) => m.role === 'user');
      if (firstUserMessage) {
        const title = firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
        console.log('Updating chat title:', title);
        await prisma.chat.update({
          where: { id: chatId },
          data: { title }
        });
      }
    }

    // Generate notes for each message in the background
    console.log('Starting note generation for messages...');
    createdMessages.forEach(message => {
      generateNoteFromMessage(message).catch(error => {
        console.error('Error generating note for message:', message.id, error);
      });
    });

    return NextResponse.json(createdMessages);
  } catch (error) {
    console.error('Error in message creation:', error);
    return NextResponse.json(
      { error: 'Failed to create messages' },
      { status: 500 }
    );
  }
} 