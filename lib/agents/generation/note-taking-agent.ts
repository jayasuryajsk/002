import { BaseAgent } from "../core/base-agent"
import type { AgentMessage } from "../types"

export interface Note {
  id: string
  content: string
  timestamp: string
  category?: string
  tags?: string[]
  importance?: "high" | "medium" | "low"
  source: {
    type: 'conversation'
    messageId: string
  }
}

export class NoteTakingAgent extends BaseAgent {
  constructor() {
    super(
      "note-taking",
      "You are an expert note-taking assistant specialized in capturing key information from conversations. Your task is to create concise and insightful notes that highlight the most important points and actionable insights."
    )
  }

  /**
   * Process a complete conversation exchange (both user and AI messages)
   * to extract important information and create meaningful notes
   */
  async processConversation(messages: { role: string, content: string }[]): Promise<AgentMessage> {
    const conversationText = messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n\n");

    const prompt = `
    Analyze this complete conversation exchange and create insightful notes:
    
    ${conversationText}
    
    Extract 1-3 important notes from this conversation. For each note:
    
    1. Focus on the MOST valuable information:
       - Decisions made
       - Action items
       - Key insights
       - Important facts
       - Technical details worth remembering
       - Project requirements
       - Document changes or improvements
    
    2. Categorize each note (choose ONE best category):
       - DECISION: Decisions that were made
       - ACTION: Tasks that need to be completed
       - INSIGHT: Important realizations or learnings
       - REQUIREMENT: Project specifications or needs
       - REFERENCE: Valuable information for future reference
       - TECHNICAL: Technical details or implementation notes
    
    3. Add 1-3 relevant tags for each note
    
    4. Assign an importance level (high, medium, low) based on:
       - Impact on the project
       - Urgency or timeline
       - Uniqueness or difficulty of information
    
    Format each note as follows:
    <note>
    <content>The actual note text (1-2 concise sentences)</content>
    <category>CATEGORY</category>
    <tags>tag1, tag2, tag3</tags>
    <importance>high|medium|low</importance>
    </note>
    
    DO NOT include notes that are:
    - Obvious or trivial information
    - Basic explanations of common concepts
    - Repetitive points already captured
    - General pleasantries or small talk
    
    ONLY include genuinely valuable information that would be useful to reference later.
    If nothing important was discussed, return <note><content>No significant information to note in this exchange.</content></note>
    `

    const response = await this.generateResponse(prompt)

    // Process the response to extract structured notes
    const notes = this.parseNotesFromResponse(response)

    return {
      role: this.role,
      content: notes.map(note => note.content).join("\n\n"),
      metadata: {
        timestamp: new Date().toISOString(),
        type: "conversation_notes",
        notes: notes,
        categories: notes.map(note => note.category).filter(Boolean),
        tags: notes.flatMap(note => note.tags || []),
        hasImportantInfo: notes.some(note => note.importance === "high")
      }
    }
  }

  /**
   * Parse structured notes from the agent's response
   */
  private parseNotesFromResponse(response: string): Array<{
    content: string;
    category?: string;
    tags?: string[];
    importance?: "high" | "medium" | "low";
  }> {
    const noteRegex = /<note>([\s\S]*?)<\/note>/g;
    const contentRegex = /<content>([\s\S]*?)<\/content>/;
    const categoryRegex = /<category>([\s\S]*?)<\/category>/;
    const tagsRegex = /<tags>([\s\S]*?)<\/tags>/;
    const importanceRegex = /<importance>([\s\S]*?)<\/importance>/;
    
    const notes = [];
    let match;
    
    while ((match = noteRegex.exec(response)) !== null) {
      const noteText = match[1];
      
      const contentMatch = noteText.match(contentRegex);
      const categoryMatch = noteText.match(categoryRegex);
      const tagsMatch = noteText.match(tagsRegex);
      const importanceMatch = noteText.match(importanceRegex);
      
      if (contentMatch) {
        const note: {
          content: string;
          category?: string;
          tags?: string[];
          importance?: "high" | "medium" | "low";
        } = {
          content: contentMatch[1].trim()
        };
        
        if (categoryMatch) {
          note.category = categoryMatch[1].trim();
        }
        
        if (tagsMatch) {
          note.tags = tagsMatch[1].split(',').map(tag => tag.trim());
        }
        
        if (importanceMatch) {
          const importance = importanceMatch[1].trim().toLowerCase();
          if (['high', 'medium', 'low'].includes(importance)) {
            note.importance = importance as "high" | "medium" | "low";
          }
        }
        
        notes.push(note);
      }
    }
    
    // If there are no structured notes but there is content, create a simple note
    if (notes.length === 0 && response.trim()) {
      notes.push({
        content: response.trim(),
        importance: "medium"
      });
    }
    
    return notes;
  }

  /**
   * Process a single message (legacy support)
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    // For backward compatibility
    return this.processConversation([{
      role: 'user',
      content: message.content
    }]);
  }

  /**
   * Generate a summary from a collection of notes
   */
  async summarizeNotes(notes: Note[]): Promise<string> {
    const prompt = `
    Review and summarize the following collection of notes:
    ${JSON.stringify(notes, null, 2)}
    
    Create a comprehensive, well-structured summary that:
    
    1. Groups related information by category
    2. Prioritizes information by importance level
    3. Highlights critical decisions and action items
    4. Identifies key patterns, themes, and connections
    5. Creates a timeline if temporal information is present
    
    Format the summary in markdown with:
    - Clear headings for different categories
    - Bullet points for lists of related items
    - Bold text for high-importance items
    - A "Key Takeaways" section at the top
    - An "Action Items" section if applicable
    
    The goal is to create a useful, scannable reference document.
    `

    const response = await this.generateResponse(prompt)
    return response
  }

  /**
   * Generate project-specific insights from accumulated notes
   */
  async generateInsights(notes: Note[]): Promise<string> {
    const prompt = `
    Analyze the following collection of project notes and generate deep insights:
    ${JSON.stringify(notes, null, 2)}
    
    Based on these notes, provide:
    
    1. Key Insights:
       - Identify patterns, trends, or important themes
       - Highlight any potential challenges or risks
       - Note areas of progress or accomplishment
    
    2. Missing Information:
       - Identify gaps in knowledge or documentation
       - Suggest information that needs to be gathered
    
    3. Next Steps:
       - Recommend logical next actions based on current state
       - Prioritize tasks based on importance and dependencies
    
    Format your response in clear markdown with headings and bullet points.
    Focus on providing genuine value rather than stating the obvious.
    `

    const response = await this.generateResponse(prompt)
    return response
  }
} 