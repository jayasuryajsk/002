import { BaseAgent } from "../core/base-agent"
import type { AgentMessage } from "../types"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"

/**
 * ComplianceAgent - Specializes in evaluating tender content for compliance with requirements
 * This agent verifies that all tender requirements are addressed properly
 */
export class ComplianceAgent extends BaseAgent {
  constructor() {
    super(
      "compliance",
      "You are an expert in tender compliance. Your role is to evaluate tender content against requirements to ensure full compliance and high quality.",
      "gemini-2.0-flash-001",
      "You are an expert in tender compliance. Your role is to evaluate tender content against requirements to ensure full compliance and high quality."
    )
  }

  /**
   * Evaluate content for compliance using the AI SDK
   */
  async checkCompliance(sectionTitle: string, content: string, requirements: string[]): Promise<any> {
    try {
      // Create prompt for compliance checking
      const prompt = `
        Evaluate if the following tender section meets these compliance requirements:
        
        SECTION TITLE: ${sectionTitle}
        
        REQUIREMENTS:
        ${requirements.map((req: string, i: number) => `${i+1}. ${req}`).join('\n')}
        
        SECTION CONTENT:
        ${content}
        
        For each requirement, determine if the section properly addresses it.
        Format your response as a JSON object with:
        1. An overall "passed" boolean indicating if all requirements are met
        2. An "issues" array listing any requirements that aren't properly addressed
        3. For each issue, explain why it fails to meet the requirement
        4. A "suggestions" array with specific recommendations for improving the content
        
        Example format:
        {
          "passed": false,
          "issues": [
            "Requirement #2: The section does not mention the required ISO certification"
          ],
          "suggestions": [
            "Add details about the company's ISO 9001 certification in the Quality Assurance paragraph",
            "Expand the timeline section to include specific milestone dates"
          ]
        }
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
        prompt: prompt
      });
      
      // Parse the JSON response
      try {
        // Extract the JSON from the response
        const jsonMatch = result.text.match(/```json\n([\s\S]*?)\n```/) || 
                        result.text.match(/```\n([\s\S]*?)\n```/) || 
                        result.text.match(/(\{[\s\S]*\})/);
        
        const jsonStr = jsonMatch ? jsonMatch[1] : result.text;
        return JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('Error parsing compliance check:', parseError);
        return { 
          passed: false, 
          issues: ["Failed to parse compliance check results"],
          suggestions: ["Review content manually for compliance"] 
        };
      }
    } catch (error) {
      console.error("Error checking compliance:", error);
      return { 
        passed: false, 
        issues: [`Error evaluating compliance: ${error instanceof Error ? error.message : String(error)}`],
        suggestions: ["Review content manually"] 
      };
    }
  }

  /**
   * Process a message containing draft content and evaluate for compliance
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    try {
      const data = typeof message.content === 'string'
        ? JSON.parse(message.content)
        : message.content
      
      const { 
        sectionTitle, 
        content, 
        requirements = []
      } = data
      
      // If no requirements, assume compliant
      if (requirements.length === 0) {
        return {
          role: this.role,
          content: JSON.stringify({
            sectionTitle,
            content,
            compliance: {
              passed: true,
              issues: [],
              suggestions: []
            }
          }),
          metadata: {
            timestamp: new Date().toISOString(),
            type: "compliance_check",
            passed: true
          }
        }
      }
      
      // Use the AI SDK to check compliance
      const compliance = await this.checkCompliance(sectionTitle, content, requirements);
      
      console.log(`ComplianceAgent evaluated section: "${sectionTitle}" - Passed: ${compliance.passed}`);
      
      // Return the compliance result
      return {
        role: this.role,
        content: JSON.stringify({
          sectionTitle,
          content,
          compliance
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          type: "compliance_check",
          passed: compliance.passed,
          issueCount: (compliance.issues || []).length
        }
      }
    } catch (error) {
      console.error("ComplianceAgent error:", error);
      
      // Parse the message content to extract sectionTitle and content if possible
      let sectionTitle = 'Section';
      let content = '';
      try {
        const parsedContent = typeof message.content === 'string' 
          ? JSON.parse(message.content) 
          : message.content;
        sectionTitle = parsedContent.sectionTitle || 'Section';
        content = parsedContent.content || '';
      } catch (parseError) {
        // If parsing fails, use defaults
      }
      
      return {
        role: this.role,
        content: JSON.stringify({
          sectionTitle,
          content,
          compliance: {
            passed: false,
            issues: [`Error evaluating compliance: ${error instanceof Error ? error.message : String(error)}`],
            suggestions: ["Review content manually"]
          }
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          error: true,
          passed: false
        }
      }
    }
  }
}

