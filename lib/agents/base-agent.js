/**
 * Base agent class that provides core functionality for all agents
 */
class BaseAgent {
  constructor(role, context = "", model = "gemini-2.0-flash-001") {
    this.role = role;
    this.context = context;
    this.model = model;
    this.tools = new Map(); // Map of tool name to tool object
    this.systemPrompt = "You are an expert assistant specialized in tender document processing. Always provide detailed, structured outputs in the exact format requested. Avoid overly concise or minimal responses.";
  }

  /**
   * Generate a response using AI based on the provided prompt
   */
  async generateResponse(prompt, options = {}) {
    try {
      // If we have files, use the API route
      if (options.files && options.files.length > 0) {
        return this.generateResponseViaAPI(prompt, options);
      }
      
      // Get API key from environment variables
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('GOOGLE_GENERATIVE_AI_API_KEY or GOOGLE_API_KEY environment variable is not set');
      }
      
      // Use direct Gemini API
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      
      const model = genAI.getGenerativeModel({ 
        model: this.model,
        systemInstruction: this.systemPrompt
      });
      
      const result = await model.generateContent(`${this.context}\n\n${prompt}`);
      return result.response.text();
    } catch (error) {
      console.error(`Error generating response in ${this.role} agent:`, error);
      throw new Error(`Failed to generate AI response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Generate a response via API when handling files
   */
  async generateResponseViaAPI(prompt, options = {}) {
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
                content: options.files ? [
                  { type: "text", text: `${this.context}\n\n${prompt}` },
                  ...options.files.map(file => ({
                    type: "file",
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

  /**
   * Register a tool with the agent
   * @param {Object} tool - The tool to register
   */
  registerTool(tool) {
    if (!tool.name) {
      throw new Error('Tool must have a name');
    }
    
    if (!tool.execute || typeof tool.execute !== 'function') {
      throw new Error('Tool must have an execute function');
    }
    
    this.tools.set(tool.name, tool);
    return this;
  }

  /**
   * Register multiple tools at once
   * @param {Array} tools - Array of tools to register
   */
  registerTools(tools) {
    if (!Array.isArray(tools)) {
      throw new Error('registerTools expects an array of tools');
    }
    
    tools.forEach(tool => this.registerTool(tool));
    return this;
  }

  /**
   * Execute a tool by name with parameters
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} params - Parameters to pass to the tool
   */
  async executeTool(toolName, params = {}) {
    const tool = this.tools.get(toolName);
    
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }
    
    // Execute the tool
    try {
      return await tool.execute(params);
    } catch (error) {
      console.error(`Error executing tool '${toolName}':`, error);
      throw error;
    }
  }

  /**
   * Get a list of all registered tools
   */
  getTools() {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool descriptions in a format suitable for LLMs
   */
  getToolDescriptions() {
    return this.getTools().map(tool => ({
      name: tool.name,
      description: tool.description || 'No description provided',
      parameters: tool.parameters || {}
    }));
  }
  
  /**
   * Process a message and return a response
   * This should be overridden by subclasses
   */
  async processMessage(message) {
    // Default implementation just returns an error message
    return {
      role: this.role,
      content: JSON.stringify({
        error: "This is a base agent. The processMessage method should be overridden by subclasses."
      })
    };
  }
  
  /**
   * Process a message using tools and return a response
   * This can be used by subclasses to implement tool usage
   */
  async processMessageWithTools(message, useTools = true) {
    // Default implementation for tool handling
    if (!useTools || this.tools.size === 0) {
      // If tools aren't enabled or no tools registered, use standard processing
      return this.processMessage(message);
    }
    
    // This is a base implementation - subclasses should override with actual LLM calls
    return {
      role: this.role,
      content: JSON.stringify({
        error: "Tool handling not implemented for this agent type."
      })
    };
  }
}

module.exports = { BaseAgent }; 