import type { Message } from ".prisma/client"
import { NoteTakingAgent } from "./agents/note-taking-agent"
import { prisma } from "./prisma"
import { v4 as uuidv4 } from "uuid"
import { emitEvent } from "./events"

// Buffer for collecting messages in a conversation context
const messageBuffer = new Map<string, Message[]>();
const CONTEXT_WINDOW = 4; // Number of messages to consider as context

/**
 * Adds a message to the buffer and returns true if a note should be generated
 */
function addToMessageBuffer(message: Message): boolean {
  const conversationId = message.chatId;
  
  // Initialize buffer for this conversation if needed
  if (!messageBuffer.has(conversationId)) {
    messageBuffer.set(conversationId, []);
  }
  
  const buffer = messageBuffer.get(conversationId)!;
  
  // Add current message to buffer
  buffer.push(message);
  
  // If buffer exceeds window size, remove oldest message
  if (buffer.length > CONTEXT_WINDOW) {
    buffer.shift();
  }
  
  // Generate note if:
  // 1. We have at least 2 messages (a complete exchange)
  // 2. The latest message is from the assistant (marking end of an exchange)
  return buffer.length >= 2 && message.role === 'assistant';
}

/**
 * Generate a note from a conversation context
 */
export async function generateNoteFromMessage(message: Message) {
  try {
    console.log('Processing message for notes:', message.id);

    // Skip non-text messages
    if (message.type !== 'text') {
      console.log('Skipping note generation - message is non-text:', { type: message.type });
      return;
    }

    // Add to buffer and check if we should generate a note
    const shouldGenerateNote = addToMessageBuffer(message);
    if (!shouldGenerateNote) {
      console.log('Not generating note yet - waiting for complete exchange');
      return;
    }

    // Get the conversation buffer
    const conversationBuffer = messageBuffer.get(message.chatId) || [];
    
    // Ensure we have at least one user and one assistant message
    const hasUserMessage = conversationBuffer.some(m => m.role === 'user');
    const hasAssistantMessage = conversationBuffer.some(m => m.role === 'assistant');
    
    if (!hasUserMessage || !hasAssistantMessage) {
      console.log('Skipping note generation - incomplete exchange');
      return;
    }

    console.log('Creating NoteTakingAgent...');
    const noteTakingAgent = new NoteTakingAgent();
    
    console.log('Processing conversation with agent...');
    const agentResponse = await noteTakingAgent.processConversation(
      conversationBuffer.map(m => ({ 
        role: m.role, 
        content: m.content 
      }))
    );
    
    console.log('Agent response:', agentResponse);

    // Extract notes from metadata
    const metadata = agentResponse.metadata || {};
    const notes = metadata.notes || [];
    
    if (notes.length === 0) {
      console.log('No significant notes generated from this exchange');
      return;
    }
    
    console.log(`Creating ${notes.length} notes in database...`);
    
    // Create notes in database and emit events
    for (const noteData of notes) {
      // Skip empty notes
      if (!noteData.content || noteData.content.includes('No significant information')) {
        continue;
      }
      
      const note = await prisma.note.create({
        data: {
          id: uuidv4(),
          content: noteData.content,
          category: noteData.category,
          tags: noteData.tags || [],
          messageId: message.id,
          conversationId: message.chatId,
        }
      });
      
      console.log('Note created successfully:', note.id);
      
      // Emit event for real-time updates with importance level
      emitEvent('note.created', {
        id: note.id,
        content: note.content,
        timestamp: note.createdAt.toISOString(),
        category: note.category,
        tags: note.tags,
        importance: noteData.importance || 'medium',
        conversationId: note.conversationId
      });
    }

  } catch (error) {
    // Log error but don't throw - we don't want to interrupt the chat flow
    console.error('Error generating note:', error);
  }
}

/**
 * Generate insights from all notes in a conversation
 */
export async function generateInsightsFromNotes(conversationId: string): Promise<string> {
  try {
    // Get all notes for this conversation
    const notes = await prisma.note.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' }
    });
    
    if (notes.length === 0) {
      return "No notes available to generate insights.";
    }
    
    const noteTakingAgent = new NoteTakingAgent();
    return await noteTakingAgent.generateInsights(
      notes.map(note => ({
        id: note.id,
        content: note.content,
        timestamp: note.createdAt.toISOString(),
        category: note.category || undefined,
        tags: note.tags,
        source: {
          type: 'conversation',
          messageId: note.messageId
        }
      }))
    );
    
  } catch (error) {
    console.error('Error generating insights from notes:', error);
    return "Failed to generate insights. Please try again.";
  }
}

/**
 * Clear the message buffer for a conversation
 */
export function clearMessageBuffer(conversationId: string): void {
  messageBuffer.delete(conversationId);
} 