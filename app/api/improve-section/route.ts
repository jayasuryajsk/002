import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { marked } from 'marked'

// Initialize Google AI with API key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "")

// Helper function to convert HTML to markdown
function htmlToMarkdown(html: string): string {
  // Simple implementation that removes HTML tags
  // Use a regex-based approach instead of DOM to avoid server-side issues
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    const { content, instruction } = await request.json()
    
    // Basic validation
    if (!content) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 })
    }

    if (!instruction) {
      return NextResponse.json({ error: 'No instruction provided' }, { status: 400 })
    }

    // Convert content to plain text if it's HTML
    const textContent = content.startsWith('<') 
      ? htmlToMarkdown(content) 
      : content
    
    // Use Gemini Flash model for optimal performance
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-001",
      generationConfig: {
        temperature: 0.4,
        topK: 20,
        topP: 0.95,
        maxOutputTokens: 4096,
      }
    })
    
    // Create a prompt for improving the section
    const prompt = `
    You are an expert tender writer with years of experience in government and corporate proposals.
    
    I need you to improve the following content from a tender document based on this instruction:
    "${instruction}"
    
    CONTENT:
    ${textContent}
    
    Please follow these requirements:
    1. Maintain the original organizational structure and key information
    2. Use professional language appropriate for formal tender documents
    3. Be specific, detailed, and persuasive
    4. Include factual information and avoid vague statements
    5. Return the improved content in well-formatted markdown
    6. Ensure proper spacing and formatting for lists and paragraphs
    7. Do not add any explanations before or after - just return the improved content
    
    Your output will be rendered directly in the tender document, so use proper markdown formatting.
    `
    
    // Generate the improved section content
    const result = await model.generateContent(prompt)
    const improvedContent = result.response.text()
    
    // Convert improved markdown to HTML
    const html = marked.parse(improvedContent)
    
    // Return the HTML response
    return new Response(html)
    
  } catch (error: any) {
    console.error('Error improving section:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to improve section' },
      { status: 500 }
    )
  }
}