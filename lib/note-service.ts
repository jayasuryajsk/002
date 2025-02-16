import type { Message } from ".prisma/client"
import { NoteTakingAgent } from "./agents/note-taking-agent"
import { prisma } from "./prisma"
import { v4 as uuidv4 } from "uuid"
import { emitEvent } from "./events"

export async function generateNoteFromMessage(message: Message) {
  try {
    console.log('Starting note generation for message:', message.id);

    // Skip note generation for assistant messages and non-text messages
    if (message.role === 'assistant' || message.type !== 'text') {
      console.log('Skipping note generation - message is assistant or non-text:', { role: message.role, type: message.type });
      return;
    }

    console.log('Creating NoteTakingAgent...');
    const noteTakingAgent = new NoteTakingAgent();
    
    console.log('Processing message with agent...');
    const agentResponse = await noteTakingAgent.processMessage({
      role: 'note-taking',
      content: message.content
    });
    console.log('Agent response:', agentResponse);

    // Extract potential categories/tags from metadata
    const metadata = agentResponse.metadata || {};
    
    console.log('Creating note in database...');
    const note = await prisma.note.create({
      data: {
        id: uuidv4(),
        content: agentResponse.content,
        category: metadata.category as string | undefined,
        tags: metadata.tags as string[] | undefined,
        messageId: message.id,
        conversationId: message.chatId,
      }
    });
    console.log('Note created successfully:', note.id);

    // Emit event for real-time updates
    emitEvent('note.created', {
      id: note.id,
      content: note.content,
      timestamp: note.createdAt.toISOString(),
      category: note.category,
      tags: note.tags,
      conversationId: note.conversationId
    });

  } catch (error) {
    // Log error but don't throw - we don't want to interrupt the chat flow
    console.error('Error generating note:', error);
  }
} 