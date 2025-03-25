import { BaseAgent } from "../core/base-agent";
import type { AgentMessage } from "../types";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

/**
 * QuestionAnsweringAgent - Specializes in providing answers to specific questions
 * This agent focuses on understanding questions and providing concise, accurate responses
 */
export class QuestionAnsweringAgent extends BaseAgent {
  constructor() {
    super(
      "qa",
      "You are an expert question answering agent. Your role is to provide accurate, well-researched answers to specific questions.",
      "gemini-2.0-flash-001",
      "You are an expert question answering agent. Your role is to provide accurate, well-researched answers to specific questions."
    );
  }
  
  /**
   * Process a message containing a question and context, and return an answer
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    try {
      const data = typeof message.content === 'string'
        ? JSON.parse(message.content)
        : message.content;
      
      const { question, context = [] } = data;
      
      if (!question) {
        throw new Error("No question provided");
      }
      
      // Create context string from the provided context
      const contextText = context.length > 0
        ? context.map((c: string, i: number) => `[Document ${i+1}]\n${c}`).join('\n\n')
        : "No context provided.";
      
      // Create prompt
      const prompt = `
        Answer the following question based on the provided context:
        
        Question: ${question}
        
        Context:
        ${contextText}
        
        Instructions:
        1. If the context contains the information needed, provide a clear and accurate answer
        2. If the context is insufficient, clearly state what's missing
        3. If the question cannot be answered from the context, say so - do not make up information
        4. Use bullet points when appropriate for clarity
        5. Always base your answer strictly on the provided context
        
        Answer:
      `;
      
      // Get API key
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || "";
      if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
      }
      
      // Create Google AI provider
      const googleAI = createGoogleGenerativeAI({
        apiKey: apiKey
      });
      
      // Generate content using the AI SDK
      const result = await generateText({
        model: googleAI("gemini-2.0-flash-001"),
        prompt: prompt,
        maxTokens: 2000,
      });
      
      console.log(`QuestionAnsweringAgent generated an answer for question: "${question.substring(0, 50)}..."`);
      
      return {
        role: this.role,
        content: JSON.stringify({
          question,
          answer: result.text,
          hasContext: context.length > 0
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          type: "answer"
        }
      };
    } catch (error) {
      console.error("QuestionAnsweringAgent error:", error);
      return {
        role: this.role,
        content: JSON.stringify({
          error: `Failed to process question: ${error instanceof Error ? error.message : String(error)}`,
          answer: "I encountered an error while processing your question. Please try again or rephrase your question."
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          error: true
        }
      };
    }
  }
} 