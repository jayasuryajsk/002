import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Message } from '@/lib/chat';

type ChatWithMessages = {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    id: string;
    content: string;
    role: string;
    type: string;
    fileDetails: string | null;
    createdAt: Date;
    chatId: string;
  }>;
};

export async function POST(req: Request) {
  try {
    const { title } = await req.json();
    
    const chat = await prisma.chat.create({
      data: {
        title
      },
      include: {
        messages: true
      }
    });

    return NextResponse.json(chat);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create chat' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const chats = await prisma.chat.findMany({
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    return NextResponse.json(chats);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    );
  }
} 