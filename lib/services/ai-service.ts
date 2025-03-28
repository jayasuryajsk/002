import { GoogleGenerativeAI } from "@google/generative-ai";
import { Message } from "ai";
import { AgentRole, getModelConfigForAgent, ModelConfig } from "../config/ai-models";
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

// Environment variable validation
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not defined');
}

interface AIServiceConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}

class AIService {
  private static instance: AIService;
  private readonly apiKey: string;
  private embeddings: GoogleGenerativeAIEmbeddings;
  private genAI: GoogleGenerativeAI;

  private constructor() {
    this.apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: this.apiKey,
    });
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Get a model instance for a specific agent role
   */
  private getModel(role: AgentRole) {
    const modelConfig = getModelConfigForAgent(role);
    return this.genAI.getGenerativeModel({
      model: modelConfig.name,
      generationConfig: {
        temperature: modelConfig.temperature,
        topK: modelConfig.topK,
        topP: modelConfig.topP,
        maxOutputTokens: modelConfig.maxTokens,
      },
    });
  }

  /**
   * Generate text using the AI model
   */
  public async generateText(
    prompt: string,
    role: AgentRole,
    config?: AIServiceConfig
  ): Promise<string> {
    const model = this.getModel(role);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  /**
   * Process a chat conversation
   */
  public async chat(
    messages: Message[],
    role: AgentRole = 'chat',
    config?: AIServiceConfig
  ): Promise<string> {
    const model = this.getModel(role);

    const history = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({
      history,
      generationConfig: config,
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;
    return response.text();
  }

  /**
   * Stream a chat conversation
   */
  public async streamChat(
    messages: Message[],
    role: AgentRole = 'chat',
    config?: AIServiceConfig
  ) {
    const model = this.getModel(role);

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({
      history,
      generationConfig: config,
    });

    const lastMessage = messages[messages.length - 1];
    return chat.sendMessageStream(lastMessage.content);
  }

  /**
   * Generate embeddings for text
   */
  public async generateEmbeddings(text: string): Promise<number[]> {
    const embeddings = await this.embeddings.embedQuery(text);
    return embeddings;
  }

  /**
   * Generate embeddings for multiple texts
   */
  public async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    const embeddings = await this.embeddings.embedDocuments(texts);
    return embeddings;
  }
}

// Export a singleton instance
export const aiService = AIService.getInstance();

// Export types
export type { Message, AIServiceConfig }; 