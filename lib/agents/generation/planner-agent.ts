import { BaseAgent } from "../core/base-agent";
import type { AgentMessage, TenderRequirement } from "../types";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

/**
 * PlannerAgent - Specializes in planning tender documents
 * This agent creates a structured plan based on requirements
 */
export class PlannerAgent extends BaseAgent {
  constructor() {
    super(
      "planner",
      "You are an expert tender planner. Your role is to analyze requirements and create a logical structure for tender documents.",
      "gemini-2.0-flash-001",
      "You are an expert tender planner. Your role is to analyze requirements and create a logical structure for tender documents."
    );
  }
  
  /**
   * Generate a tender plan using AI SDK
   */
  async generatePlan(
    prompt: string = "",
    requirements: TenderRequirement[] = [],
    companyContext: string = "",
    additionalContext: string = ""
  ): Promise<any> {
    try {
      // Format requirements for the prompt
      const requirementsText = requirements.length > 0
        ? `\nRequirements:\n${requirements.map((req: TenderRequirement, i: number) => 
            `${i+1}. [${req.priority.toUpperCase()}] [${req.category}] ${req.description}`
          ).join('\n')}`
        : '';
      
      // Create a limited company context to avoid token limit issues
      const limitedCompanyContext = companyContext 
        ? "Company context available (not included in full to avoid token limits)"
        : "";
        
      // Create prompt for plan generation
      const planningPrompt = `
        Create a detailed plan for a tender document based on the following information:
        
        ${prompt ? `User's Prompt: ${prompt}\n` : ''}
        
        ${requirementsText}
        
        ${limitedCompanyContext}
        
        ${additionalContext ? `\nAdditional Context:\n${additionalContext}` : ''}
        
        Guidelines:
        1. Create 3-7 main sections that would make a complete, winning tender
        2. For each section, provide a title and brief description
        3. Assign relevant requirements to each section
        4. Identify evaluation criteria that will be used to judge this tender
        
        Return your response as a JSON object with:
        1. A "sections" array with objects containing "title", "description", "requirements" (array of requirement IDs), and "relevantDocuments" (empty array)
        2. A "requirements" array containing all the input requirements 
        3. An "evaluationCriteria" array listing criteria that will be used to evaluate the tender
        
        Example format:
        {
          "plan": {
            "sections": [
              {
                "title": "Executive Summary",
                "description": "Overview of the proposed solution and key benefits",
                "requirements": ["Must provide project summary", "Must include timeline overview"],
                "relevantDocuments": []
              },
              ...
            ],
            "requirements": [
              {
                "id": "req-1",
                "description": "Must provide project summary",
                "priority": "high",
                "category": "documentation"
              },
              ...
            ],
            "evaluationCriteria": [
              "Technical merit (40%)",
              "Past performance (30%)",
              "Cost (30%)"
            ]
          }
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
        prompt: planningPrompt
      });
      
      // Try to parse the JSON from the response
      const jsonMatch = result.text.match(/```json\n([\s\S]*?)\n```/) || 
                      result.text.match(/```\n([\s\S]*?)\n```/) || 
                      result.text.match(/(\{[\s\S]*\})/);
      
      const jsonStr = jsonMatch ? jsonMatch[1] : result.text;
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error("Error generating plan:", error);
      throw error;
    }
  }
  
  /**
   * Process a message containing requirements and create a tender plan
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    try {
      const data = typeof message.content === 'string'
        ? JSON.parse(message.content)
        : message.content;
      
      const { 
        action,
        prompt = "", 
        requirements = [],
        companyContext = "",
        additionalContext = ""
      } = data;
      
      if (action !== "createPlan") {
        return {
          role: this.role,
          content: JSON.stringify({
            error: "Unsupported action. Only 'createPlan' is supported."
          }),
          metadata: {
            timestamp: new Date().toISOString(),
            error: true
          }
        };
      }
      
      try {
        // Use the AI SDK to generate the plan
        const planObject = await this.generatePlan(prompt, requirements, companyContext, additionalContext);
        
        console.log(`PlannerAgent created plan with ${planObject.plan?.sections?.length || 0} sections`);
        
        return {
          role: this.role,
          content: JSON.stringify(planObject),
          metadata: {
            timestamp: new Date().toISOString(),
            type: "tender_plan",
            sectionCount: planObject.plan?.sections?.length || 0
          }
        };
      } catch (parseError) {
        console.error('Error parsing generated plan:', parseError);
        
        // Create a basic plan if parsing fails
        const basicPlan = {
          plan: {
            sections: [
              {
                title: "Executive Summary",
                description: "Overview of the proposed solution and key benefits",
                requirements: requirements.map((req: TenderRequirement) => req.description),
                relevantDocuments: []
              },
              {
                title: "Technical Approach",
                description: "Details of the proposed technical solution",
                requirements: requirements.map((req: TenderRequirement) => req.description),
                relevantDocuments: []
              },
              {
                title: "Experience and Qualifications",
                description: "Company experience, qualifications, and past performance",
                requirements: [],
                relevantDocuments: []
              },
              {
                title: "Project Timeline",
                description: "Schedule and milestones for project completion",
                requirements: [],
                relevantDocuments: []
              },
              {
                title: "Budget and Pricing",
                description: "Cost breakdown and value proposition",
                requirements: [],
                relevantDocuments: []
              }
            ],
            requirements: requirements,
            evaluationCriteria: ["Technical merit", "Past performance", "Cost"]
          }
        };
        
        return {
          role: this.role,
          content: JSON.stringify(basicPlan),
          metadata: {
            timestamp: new Date().toISOString(),
            type: "tender_plan",
            sectionCount: basicPlan.plan.sections.length,
            isBackupPlan: true
          }
        };
      }
    } catch (error) {
      console.error("PlannerAgent error:", error);
      
      // Return an error message
      return {
        role: this.role,
        content: JSON.stringify({
          error: `Failed to create tender plan: ${error instanceof Error ? error.message : String(error)}`,
          plan: {
            sections: [
              {
                title: "Tender Response",
                description: "Complete tender response",
                requirements: [],
                relevantDocuments: []
              }
            ],
            requirements: [],
            evaluationCriteria: []
          }
        }),
        metadata: {
          timestamp: new Date().toISOString(),
          error: true
        }
      };
    }
  }
} 