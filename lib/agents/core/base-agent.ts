import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { Message } from "ai"
import type { AgentMessage, AgentRole } from "../types"

export class BaseAgent {
  protected role: AgentRole
  protected context: string
  protected model: string
  protected systemPrompt: string

  constructor(role: AgentRole, context = "", model = "gemini-2.0-flash-001", systemPrompt = "") {
    this.role = role
    this.context = context
    this.model = model
    this.systemPrompt = systemPrompt || "You are an expert assistant specialized in tender document processing. Always provide detailed, structured outputs in the exact format requested. Avoid overly concise or minimal responses."
  }

  async generateResponse(prompt: string, options?: {
    files?: Array<{ data: Buffer; mimeType: string }>
  }): Promise<string> {
    try {
      // If we have files, use the API route
      if (options?.files && options.files.length > 0) {
        return this.generateResponseViaAPI(prompt, options);
      }
      
      // Use environment variables for API key
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
      console.log('Using API key:', apiKey ? apiKey.substring(0, 10) + '...' : 'none');
      if (!apiKey) {
        throw new Error('GOOGLE_GENERATIVE_AI_API_KEY or GOOGLE_API_KEY environment variable is not set');
      }
      
      // Create provider with the Vercel AI SDK
      const provider = createGoogleGenerativeAI({
        apiKey: apiKey,
      });

      // Prepare messages array for system prompt if available
      const messages = [];
      if (this.systemPrompt) {
        messages.push({
          role: 'system' as const,
          content: this.systemPrompt,
        });
      }
      
      // Add user message with context and prompt
      messages.push({
        role: 'user' as const,
        content: `${this.context}\n\n${prompt}`,
      });
      
      // Generate text using Vercel AI SDK
      const result = await generateText({
        model: provider(this.model),
        messages: messages,
      });
      
      return result.text;
    } catch (error) {
      console.error(`Error generating response in ${this.role} agent:`, error);
      console.error(`Model being used: ${this.model}`);
      console.error(`API Key: ${process.env.GOOGLE_GENERATIVE_AI_API_KEY?.substring(0, 10)}...`);
      if (error instanceof Error && error.stack) {
        console.error(`Stack trace: ${error.stack}`);
      }
      throw new Error(`Failed to generate AI response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  private async generateResponseViaAPI(prompt: string, options: { 
    files?: Array<{ data: Buffer; mimeType: string }> 
  }): Promise<string> {
    // Get the base URL for API calls
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

    // Try up to 3 times with increasing timeouts
    let lastError = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Generating response attempt ${attempt}/${maxRetries}`);
        
        const response = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              {
                role: "system",
                content: this.systemPrompt
              },
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
          throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}`);
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
        
        // Check if we got a meaningful response (not empty or too short)
        if (!text || text.trim().length < 5) {
          console.warn(`Got suspiciously short response: "${text}"`);
          throw new Error("Response too short or empty");
        }

        return text;
      } catch (error) {
        console.error(`Error on attempt ${attempt}:`, error);
        lastError = error;
        
        // If we haven't reached max retries, wait before trying again
        if (attempt < maxRetries) {
          const delay = 1000 * attempt; // Increasing delay: 1s, 2s, 3s...
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error("Failed to generate response after multiple attempts");
  }

  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    throw new Error("processMessage must be implemented by derived classes")
  }
}

