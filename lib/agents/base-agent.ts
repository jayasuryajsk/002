import { google } from "@ai-sdk/google"
import { Message } from "ai"
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
    // Get the base URL for API calls
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: options?.files ? [
              { type: "text", text: `${this.context}\n\n${prompt}` },
              ...options.files.map(file => ({
                type: "file" as const,
                data: Array.from(file.data),
                mimeType: file.mimeType
              }))
            ] : `${this.context}\n\n${prompt}`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error("Failed to generate response");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader available");

    const decoder = new TextDecoder();
    let text = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            text += parsed;
          } catch {
            text += data;
          }
        }
      }
    }

    return text;
  }

  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    throw new Error("processMessage must be implemented by derived classes")
  }
}

