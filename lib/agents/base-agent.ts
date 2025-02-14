import { google } from "@ai-sdk/google"
import { generateText } from "ai"
import type { AgentMessage, AgentRole } from "./types"

export class BaseAgent {
  protected role: AgentRole
  protected context: string
  protected model: string

  constructor(role: AgentRole, context = "", model = "gemini-2.0-flash-001") {
    this.role = role
    this.context = context
    this.model = model
  }

  protected async generateResponse(prompt: string, options?: { 
    files?: Array<{ data: Buffer; mimeType: string }> 
  }): Promise<string> {
    const { text } = await generateText({
      model: google(this.model),
      messages: [
        {
          role: "user",
          content: options?.files ? [
            { type: "text", text: `${this.context}\n\n${prompt}` },
            ...options.files.map(file => ({
              type: "file" as const,
              data: file.data,
              mimeType: file.mimeType
            }))
          ] : `${this.context}\n\n${prompt}`
        }
      ]
    })
    return text
  }

  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    throw new Error("processMessage must be implemented by derived classes")
  }
}

