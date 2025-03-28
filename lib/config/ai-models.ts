import { GoogleGenerativeAI } from '@google/generative-ai';

// Model configuration types
export interface ModelConfig {
  name: string;
  description: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  safetySettings?: Array<{
    category: 'HARM_CATEGORY_HARASSMENT' | 'HARM_CATEGORY_HATE_SPEECH' | 'HARM_CATEGORY_SEXUALLY_EXPLICIT' | 'HARM_CATEGORY_DANGEROUS_CONTENT';
    threshold: 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';
  }>;
}

// Agent roles and their default models
export type AgentRole = 
  | 'chat'
  | 'search'
  | 'analysis'
  | 'drafting'
  | 'planning'
  | 'compliance'
  | 'requirements'
  | 'vector-search'
  | 'question-answering'
  | 'retrieval';

// Default model configurations
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // Main chat model
  CHAT: {
    name: 'gemini-2.0-flash-001',
    description: 'Fast, efficient model for chat interactions',
    maxTokens: 2048,
    temperature: 0.7,
  },

  // Analysis models
  ANALYSIS: {
    name: 'gemini-2.0-flash-001',
    description: 'Specialized for deep analysis tasks',
    maxTokens: 4096,
    temperature: 0.3,
  },

  // Generation models
  GENERATION: {
    name: 'gemini-2.0-flash-001',
    description: 'Optimized for content generation',
    maxTokens: 8192,
    temperature: 0.7,
  },

  // Search and retrieval models
  SEARCH: {
    name: 'gemini-2.0-flash-001',
    description: 'Efficient for search and retrieval tasks',
    maxTokens: 2048,
    temperature: 0.3,
  },
};

// Map agent roles to specific model configurations
export const AGENT_MODEL_MAPPING: Record<AgentRole, keyof typeof MODEL_CONFIGS> = {
  chat: 'CHAT',
  search: 'SEARCH',
  analysis: 'ANALYSIS',
  drafting: 'GENERATION',
  planning: 'ANALYSIS',
  compliance: 'ANALYSIS',
  requirements: 'ANALYSIS',
  'vector-search': 'SEARCH',
  'question-answering': 'SEARCH',
  retrieval: 'SEARCH',
};

// Helper function to get model config for an agent
export function getModelConfigForAgent(role: AgentRole): ModelConfig {
  const modelKey = AGENT_MODEL_MAPPING[role];
  return MODEL_CONFIGS[modelKey];
}

// Helper function to get model config by name
export function getModelConfigByName(modelKey: keyof typeof MODEL_CONFIGS): ModelConfig {
  return MODEL_CONFIGS[modelKey];
} 