import { BaseAgent } from "../core/base-agent";
import type { AgentMessage, AgentRole } from "../types";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

/**
 * QuestionAskingAgent - Specializes in formulating questions
 * This agent helps analyze complex topics and generate insightful questions
 */
export class QuestionAskingAgent extends BaseAgent {
  constructor() {
    super(
      "researcher" as AgentRole,
      "You are an expert question asking agent. Your role is to analyze information and generate insightful questions.",
      "gemini-2.0-flash-001",
      "You are an expert question asking agent. Your role is to analyze information and generate insightful questions."
    );
  }
  
  /**
   * Process a message containing a topic and generate insightful questions
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    try {
      const data = typeof message.content === 'string'
        ? JSON.parse(message.content)
        : message.content;
      
      const { topic, context = "", count = 5 } = data;
      
      if (!topic) {
        throw new Error("No topic provided");
      }
      
      // Create prompt for question generation
      const prompt = `
        Generate ${count} insightful questions about the following topic:
        
        Topic: ${topic}
        ${context ? `\nContext:\n${context}` : ''}
        
        Generate questions that:
        1. Explore different aspects of the topic
        2. Range from factual to analytical
        3. Would help someone deeply understand the subject
        4. Are clear and well-formulated
        
        Return the questions as a JSON array of strings in this format:
        ["Question 1?", "Question 2?", ... ]
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
      });
      
      let questions: string[] = [];
      
      try {
        // Extract the JSON from the response
        const jsonMatch = result.text.match(/```json\n([\s\S]*?)\n```/) || 
                          result.text.match(/```\n([\s\S]*?)\n```/) || 
                          result.text.match(/(\[[\s\S]*\])/);
        
        const jsonStr = jsonMatch ? jsonMatch[1] : result.text;
        questions = JSON.parse(jsonStr);
        
        if (!Array.isArray(questions)) {
          throw new Error("Generated content is not a valid array");
        }
      } catch (parseError) {
        console.error("Error parsing questions:", parseError);
        // Fallback: Extract questions directly from text
        questions = result.text
          .split('\n')
          .filter(line => line.trim().match(/^\d+\.\s+.+\?$/) || line.trim().match(/^".+\?",?$/))
          .map(line => line.replace(/^\d+\.\s+/, '').replace(/^"|"$/g, '').replace(/",$/g, '').trim());
      }
      
      console.log(`QuestionAskingAgent generated ${questions.length} questions about "${topic}"`);
      
      return {
        role: this.role,
        content: JSON.stringify({
          topic,
          questions: questions,
          count: questions.length
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          type: "questions"
        }
      };
    } catch (error) {
      console.error("QuestionAskingAgent error:", error);
      return {
        role: this.role,
        content: JSON.stringify({
          error: `Failed to generate questions: ${error instanceof Error ? error.message : String(error)}`,
          questions: [],
          topic: ""
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          error: true
        }
      };
    }
  }
  
  /**
   * Generate questions about a specific topic 
   */
  async generateQuestions(
    topic: string,
    count: number = 5,
    documentType: 'company' | 'source' | 'all' = 'all'
  ): Promise<string[]> {
    try {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || "";
      if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
      }
      
      // Create Google AI provider
      const googleAI = createGoogleGenerativeAI({
        apiKey: apiKey
      });
      
      // Create prompt for question generation
      const prompt = `
        Generate ${count} insightful questions about the following topic:
        
        Topic: ${topic}
        
        Generate questions that:
        1. Explore different aspects of the topic
        2. Range from factual to analytical
        3. Would help someone deeply understand the subject
        4. Are clear and well-formulated
        
        Return the questions as a JSON array of strings in this format:
        ["Question 1?", "Question 2?", ... ]
      `;
      
      // Generate content using the AI SDK
      const result = await generateText({
        model: googleAI("gemini-2.0-flash-001"),
        prompt: prompt,
      });
      
      let questions: string[] = [];
      
      try {
        // Extract the JSON from the response
        const jsonMatch = result.text.match(/```json\n([\s\S]*?)\n```/) || 
                          result.text.match(/```\n([\s\S]*?)\n```/) || 
                          result.text.match(/(\[[\s\S]*\])/);
        
        const jsonStr = jsonMatch ? jsonMatch[1] : result.text;
        questions = JSON.parse(jsonStr);
        
        if (!Array.isArray(questions)) {
          throw new Error("Generated content is not a valid array");
        }
      } catch (parseError) {
        console.error("Error parsing questions:", parseError);
        // Fallback: Extract questions directly from text
        questions = result.text
          .split('\n')
          .filter(line => line.trim().match(/^\d+\.\s+.+\?$/) || line.trim().match(/^".+\?",?$/))
          .map(line => line.replace(/^\d+\.\s+/, '').replace(/^"|"$/g, '').replace(/",$/g, '').trim());
      }
      
      console.log(`Generated ${questions.length} questions about "${topic}"`);
      
      return questions;
    } catch (error) {
      console.error("Error generating questions:", error);
      return [];
    }
  }
  
  /**
   * Format a message to ask questions
   */
  static formatQuestionGenerationMessage(topic: string, count: number = 5): AgentMessage {
    return {
      role: "orchestrator",
      content: JSON.stringify({
        topic,
        count
      })
    };
  }
} 