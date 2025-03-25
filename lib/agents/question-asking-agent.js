const { BaseAgent } = require("./base-agent");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { QuestionAnsweringAgent } = require("./question-answering-agent");

/**
 * QuestionAskingAgent - Specializes in formulating insightful questions to extract 
 * information from indexed documents. Works in tandem with QuestionAnsweringAgent.
 */
class QuestionAskingAgent extends BaseAgent {
  constructor() {
    super(
      "researcher", // Using "researcher" as the role to stay within allowed types
      "You are an expert researcher focused on asking insightful questions to extract information from documents."
    );
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');
    this.qaAgent = new QuestionAnsweringAgent();
  }
  
  /**
   * Process a request to generate questions and get answers based on a topic
   */
  async processMessage(message) {
    try {
      const data = typeof message.content === 'string' 
        ? JSON.parse(message.content) 
        : message.content;
      
      const { 
        topic, 
        documentType = 'all',  // 'company', 'source', or 'all'
        questionCount = 5,
        getAnswers = true
      } = data;
      
      if (!topic) {
        return {
          role: this.role,
          content: JSON.stringify({
            success: false,
            error: "Topic is required",
            questions: [],
            answers: []
          })
        };
      }
      
      // Generate relevant questions for the topic
      const questions = await this.generateQuestions(topic, questionCount, documentType);
      
      // If requested, get answers to these questions
      let answers = [];
      if (getAnswers && questions.length > 0) {
        answers = await this.getAnswersToQuestions(questions, documentType);
      }
      
      return {
        role: this.role,
        content: JSON.stringify({
          success: true,
          topic,
          documentType,
          questions,
          answers
        })
      };
    } catch (error) {
      console.error('Error in QuestionAskingAgent:', error);
      return {
        role: this.role,
        content: JSON.stringify({
          success: false,
          error: `Error generating questions: ${error.message}`,
          questions: [],
          answers: []
        })
      };
    }
  }
  
  /**
   * Generate relevant questions for a given topic
   */
  async generateQuestions(topic, count = 5, documentType = 'all') {
    try {
      // Select the prompt based on document type
      let contextPrompt = "Ask questions that would help extract information from";
      switch (documentType) {
        case 'company':
          contextPrompt += " company documents like profiles, capabilities, past projects, etc.";
          break;
        case 'source':
          contextPrompt += " tender source documents like RFPs, requirements, specifications, etc.";
          break;
        case 'all':
        default:
          contextPrompt += " both company documents and tender source documents.";
          break;
      }
      
      // Generate questions using Google's Gemini
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
      
      const prompt = `
        You are tasked with generating insightful questions about the topic: "${topic}".
        
        ${contextPrompt}
        
        Generate exactly ${count} clear, focused questions that will help extract specific information.
        
        Format your response as a JSON array of strings, containing only the questions.
        Example: ["Question 1?", "Question 2?", "Question 3?"]
      `;
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Extract JSON array from response
      const responseTextSingleLine = responseText.replace(/\n/g, " ");
      const jsonMatch = responseTextSingleLine.match(/\[(.*)\]/);
      if (!jsonMatch) {
        throw new Error("Failed to generate questions in the expected format");
      }
      
      try {
        const questions = JSON.parse(jsonMatch[0]);
        return Array.isArray(questions) ? questions.slice(0, count) : [];
      } catch (parseError) {
        console.error("Error parsing questions:", parseError);
        // Fallback parsing for malformed JSON
        const questionMatches = responseText.match(/"([^"]+)"/g);
        return questionMatches 
          ? questionMatches.map(q => q.replace(/"/g, '')).slice(0, count) 
          : [];
      }
    } catch (error) {
      console.error("Error generating questions:", error);
      return [];
    }
  }
  
  /**
   * Get answers to a list of questions using the QA agent
   */
  async getAnswersToQuestions(questions, documentType = 'all') {
    try {
      const answers = [];
      
      // Process each question sequentially to avoid rate limiting
      for (const question of questions) {
        // Format the request for the QA agent
        const request = QuestionAnsweringAgent.formatQuestionMessage(question, documentType);
        
        // Get the answer
        const response = await this.qaAgent.processMessage(request);
        
        // Parse the response
        const responseData = JSON.parse(response.content);
        
        // Add to answers array
        answers.push({
          question,
          answer: responseData.success ? responseData.answer : "Could not find an answer to this question."
        });
      }
      
      return answers;
    } catch (error) {
      console.error("Error getting answers:", error);
      return questions.map(q => ({
        question: q,
        answer: "Error retrieving answer."
      }));
    }
  }
  
  /**
   * Format a topic exploration message for this agent
   */
  static formatTopicMessage(topic, documentType = 'all', questionCount = 5, getAnswers = true) {
    return {
      role: "orchestrator",
      content: JSON.stringify({
        topic,
        documentType,
        questionCount,
        getAnswers
      })
    };
  }
}

module.exports = { QuestionAskingAgent }; 