// Tool manager for handling tool registration and execution
const { z } = require('zod');

class ToolManager {
  constructor() {
    this.tools = new Map(); // Map of tool name to tool object
  }

  /**
   * Register a tool with the manager
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
    
    // Validate parameters if schema is available
    let validatedParams = params;
    if (tool.parameters) {
      try {
        // Handle both Zod and JSON schema
        if (typeof tool.parameters.parse === 'function') {
          // It's a Zod schema
          validatedParams = tool.parameters.parse(params);
        } else {
          // Assume it's a JSON schema
          console.warn('JSON schema validation not implemented yet, proceeding without validation');
        }
      } catch (error) {
        throw new Error(`Parameter validation failed for tool '${toolName}': ${error.message}`);
      }
    }
    
    // Execute the tool
    try {
      return await tool.execute(validatedParams);
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
   * Check if a tool is registered
   * @param {string} toolName - Name of the tool to check
   */
  hasTool(toolName) {
    return this.tools.has(toolName);
  }
  
  /**
   * Create a function that calls the appropriate tool based on LLM output
   */
  createToolExecutor() {
    return async (toolName, args) => {
      return await this.executeTool(toolName, args);
    };
  }
}

// Create and export a singleton instance
const defaultToolManager = new ToolManager();

module.exports = {
  ToolManager,
  defaultToolManager
}; 