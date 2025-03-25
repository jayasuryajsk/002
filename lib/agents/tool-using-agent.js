const { BaseAgent } = require('./base-agent');
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * ToolUsingAgent - An agent that can use registered tools to complete tasks
 */
class ToolUsingAgent extends BaseAgent {
  constructor() {
    super(
      "researcher", 
      "You are an expert tender assistant that uses tools to find information and generate content."
    );
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');
  }
  
  /**
   * Process a message using tools
   */
  async processMessage(message) {
    // Always use tools if available
    return this.processMessageWithTools(message);
  }
  
  /**
   * Process a message using tools
   */
  async processMessageWithTools(message, useTools = true) {
    try {
      const messageContent = typeof message.content === 'string' 
        ? message.content 
        : JSON.stringify(message.content);
      
      // If no tools or tools disabled, just use normal AI response
      if (!useTools || this.tools.size === 0) {
        return await this.generateBasicResponse(messageContent);
      }
      
      // Format tool descriptions for the model
      const toolDescriptions = this.getToolDescriptions()
        .map(tool => {
          let paramsDescription = '';
          
          if (tool.parameters && typeof tool.parameters.describe === 'function') {
            // Get description from Zod schema if available
            try {
              const shape = tool.parameters._def?.shape();
              if (shape) {
                paramsDescription = Object.entries(shape).map(([key, value]) => {
                  const desc = value.description || '';
                  const optional = !value.isRequired;
                  return `  - ${key}${optional ? ' (optional)' : ''}: ${desc}`;
                }).join('\n');
              }
            } catch (error) {
              console.warn(`Error getting schema description for ${tool.name}:`, error);
            }
          }
          
          return `Tool: ${tool.name}
Description: ${tool.description || 'No description'}
Parameters:
${paramsDescription || '  None'}`;
        })
        .join('\n\n');
      
      // Generate a plan using AI
      const planResult = await this.generatePlan(messageContent, toolDescriptions);
      
      // Extract and execute tool calls
      const toolResults = await this.executeToolsFromPlan(planResult);
      
      // Generate final response with tool results
      return await this.generateFinalResponse(messageContent, planResult, toolResults);
    } catch (error) {
      console.error('Error in ToolUsingAgent:', error);
      return {
        role: this.role,
        content: JSON.stringify({
          error: `Error processing message: ${error.message}`,
          response: "I encountered an error while processing your request."
        })
      };
    }
  }
  
  /**
   * Generate a basic response without using tools
   */
  async generateBasicResponse(messageContent) {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });
      
      const prompt = `
        ${this.context}
        
        USER REQUEST: ${messageContent}
        
        Provide a helpful response based on your knowledge.
      `;
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      
      return {
        role: this.role,
        content: responseText
      };
    } catch (error) {
      console.error('Error generating basic response:', error);
      return {
        role: this.role,
        content: "Sorry, I encountered an error while generating a response."
      };
    }
  }
  
  /**
   * Generate a plan of which tools to use and how
   */
  async generatePlan(messageContent, toolDescriptions) {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });
      
      const prompt = `
        ${this.context}
        
        You have access to the following tools:
        
        ${toolDescriptions}
        
        USER REQUEST: ${messageContent}
        
        First, think about whether you need to use tools to fulfill this request.
        If tools are needed, create a plan with the specific tools and parameters to use.
        If no tools are needed, just say "No tools needed".
        
        Example plan:
        1. Use 'search' tool with query="company capabilities" and documentType="company" to find info about our capabilities
        2. Use 'extract_requirements' tool with topic="technical requirements" to identify key requirements
        
        YOUR PLAN:
      `;
      
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Error generating plan:', error);
      return "Error generating plan";
    }
  }
  
  /**
   * Parse and execute tools based on the plan
   */
  async executeToolsFromPlan(planText) {
    // If no tools needed or error in plan
    if (planText.includes("No tools needed") || planText.includes("Error generating")) {
      return [];
    }
    
    // Parse plan to extract tool calls
    const toolCalls = this.parseToolCalls(planText);
    
    // Execute each tool call
    const results = [];
    for (const call of toolCalls) {
      try {
        if (this.tools.has(call.tool)) {
          console.log(`Executing tool: ${call.tool} with params:`, call.params);
          const result = await this.executeTool(call.tool, call.params);
          results.push({
            tool: call.tool,
            params: call.params,
            result,
            success: true
          });
        } else {
          console.warn(`Tool not found: ${call.tool}`);
          results.push({
            tool: call.tool,
            params: call.params,
            error: "Tool not found",
            success: false
          });
        }
      } catch (error) {
        console.error(`Error executing tool ${call.tool}:`, error);
        results.push({
          tool: call.tool,
          params: call.params,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }
  
  /**
   * Parse tool calls from plan text
   */
  parseToolCalls(planText) {
    const toolCalls = [];
    const lines = planText.split('\n');
    
    // Look for patterns like:
    // 1. Use 'search' tool with query="company capabilities" and documentType="company"
    const toolCallRegex = /Use\s+['"]?(\w+)['"]?\s+tool\s+with\s+(.*)/i;
    const paramRegex = /(\w+)\s*=\s*["']([^"']*)["']/g;
    
    for (const line of lines) {
      const match = line.match(toolCallRegex);
      if (match) {
        const toolName = match[1].trim();
        const paramsText = match[2].trim();
        
        // Extract parameters
        const params = {};
        let paramMatch;
        while ((paramMatch = paramRegex.exec(paramsText)) !== null) {
          const paramName = paramMatch[1].trim();
          const paramValue = paramMatch[2].trim();
          params[paramName] = paramValue;
        }
        
        toolCalls.push({
          tool: toolName,
          params
        });
      }
    }
    
    return toolCalls;
  }
  
  /**
   * Generate final response using tool results
   */
  async generateFinalResponse(messageContent, planText, toolResults) {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });
      
      // Format tool results
      const formattedResults = toolResults.map(result => {
        const status = result.success ? "SUCCESS" : "ERROR";
        let resultText;
        
        if (result.success) {
          // For successful calls, format based on tool type
          if (result.tool === 'search' && result.result.results) {
            const sources = result.result.results.map((item, i) => 
              `Source ${i+1}: ${item.title} (${item.source}) - Relevance: ${item.relevance}`
            ).join('\n');
            
            const contentExcerpts = result.result.results.map((item, i) => 
              `Content ${i+1}:\n${item.content.substring(0, 200)}...`
            ).join('\n\n');
            
            resultText = `Found ${result.result.count} results\n${sources}\n\n${contentExcerpts}`;
          } else if (result.tool === 'answer_question' && result.result.answer) {
            resultText = `Answer: ${result.result.answer}`;
            if (result.result.sources && result.result.sources.length > 0) {
              const sources = result.result.sources.map((item, i) => 
                `Source ${i+1}: ${item.title} (${item.source})`
              ).join('\n');
              resultText += `\n\nSources:\n${sources}`;
            }
          } else if (result.tool === 'extract_requirements' && result.result.requirements) {
            const requirements = result.result.requirements.map((req, i) => 
              `- ${req}`
            ).join('\n');
            resultText = `Extracted ${result.result.count} requirements:\n${requirements}`;
          } else if (result.tool === 'generate_tender_section') {
            resultText = `Generated section: ${result.result.title}\n\n${result.result.content.substring(0, 300)}...`;
          } else {
            // Default formatting for other tools
            resultText = JSON.stringify(result.result, null, 2);
          }
        } else {
          // For failed calls
          resultText = `Error: ${result.error}`;
        }
        
        return `
TOOL: ${result.tool}
PARAMETERS: ${JSON.stringify(result.params)}
STATUS: ${status}
RESULT:
${resultText}
`;
      }).join('\n---\n');
      
      // Generate response
      const prompt = `
        ${this.context}
        
        USER REQUEST: ${messageContent}
        
        I created this plan:
        ${planText}
        
        I executed these tools with results:
        ${formattedResults || "No tools were executed."}
        
        Based on the user's request and the tool results, provide a helpful, complete response.
        Format the response appropriately with proper paragraphs, bullet points, and sections as needed.
        Do not show the raw tool calls or explain that you used tools - just provide a natural answer.
      `;
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      
      return {
        role: this.role,
        content: responseText
      };
    } catch (error) {
      console.error('Error generating final response:', error);
      
      // Fallback to simpler response if final generation fails
      let response = "Based on the information I found:\n\n";
      
      for (const result of toolResults) {
        if (result.success) {
          if (result.tool === 'answer_question' && result.result.answer) {
            response += result.result.answer + "\n\n";
          } else if (result.tool === 'generate_tender_section' && result.result.content) {
            response += result.result.content + "\n\n";
          }
        }
      }
      
      if (response === "Based on the information I found:\n\n") {
        response += "I apologize, but I wasn't able to find the specific information you requested.";
      }
      
      return {
        role: this.role,
        content: response
      };
    }
  }
}

module.exports = { ToolUsingAgent }; 