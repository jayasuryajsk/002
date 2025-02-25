import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE() {
  try {
    // Use a transaction to ensure both operations complete or neither does
    await prisma.$transaction(async (tx) => {
      // First delete all notes
      await tx.note.deleteMany({});
      // Then delete all chats
      await tx.chat.deleteMany({});
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting all chats:', error);
    return NextResponse.json(
      { error: 'Failed to delete all chats' },
      { status: 500 }
    );
  }
}
