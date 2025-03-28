declare module "llamaindex" {
  export interface LlamaCloudIndexOptions {
    name: string;
    projectName: string;
    organizationId: string;
    apiKey: string;
  }

  export interface RetrieverOptions {
    similarityTopK: number;
  }

  export interface ChatOptions {
    message: string;
    stream: boolean;
  }

  export interface ChatResponse {
    response: string;
    sourceNodes?: any[];
  }

  export class LlamaCloudIndex {
    constructor(options: LlamaCloudIndexOptions);
    asRetriever(options: RetrieverOptions): {
      retrieve: (query: string) => Promise<any[]>;
    };
  }

  export class ContextChatEngine {
    constructor(options: { retriever: any });
    chat(options: ChatOptions): Promise<ChatResponse>;
  }
} 