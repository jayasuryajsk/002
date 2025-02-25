import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const chat = await prisma.chat.create({
      data: {
        title: 'New Chat'
      },
      include: {
        messages: true
      }
    });

    return NextResponse.json(chat);
  } catch (error) {
    console.error('Chat creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create chat. Please try again.' },
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
        createdAt: 'desc'
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