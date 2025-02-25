import { GoogleGenerativeAI } from "@google/generative-ai"
import { SourceDocument } from "@/lib/agents/types"

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "")

// Add retry logic with exponential backoff
async function retryWithExponentialBackoff<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let retries = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      retries++;
      
      // If we've reached max retries or it's not a rate limit error, throw
      if (retries > maxRetries || error?.status !== 429) {
        throw error;
      }
      
      // Calculate delay with exponential backoff (1s, 2s, 4s, etc.)
      const delay = initialDelay * Math.pow(2, retries - 1);
      console.log(`Rate limit hit. Retrying in ${delay}ms (attempt ${retries}/${maxRetries})...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Declare global types for document storage
declare global {
  var sourceDocuments: SourceDocument[]
  var companyDocuments: SourceDocument[]
  var documentSummaries: Record<string, string>
}

// Initialize global storage for document summaries if it doesn't exist
if (!global.documentSummaries) {
  global.documentSummaries = {};
  console.log('Initialized empty documentSummaries object');
} else {
  console.log(`Found existing documentSummaries with ${Object.keys(global.documentSummaries).length} entries`);
}

// Process a single document and extract key information
async function processDocument(doc: SourceDocument, isSourceDoc: boolean): Promise<string> {
  // Check if we already have a summary for this document
  if (global.documentSummaries[doc.id]) {
    console.log(`Using cached summary for document: ${doc.title}`);
    return global.documentSummaries[doc.id];
  }
  
  // Use Gemini Flash for document processing
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
  
  // Prepare the prompt
  const promptText = isSourceDoc ? 
    `Analyze this tender requirement document and extract ONLY the key requirements, constraints, and evaluation criteria.
    Focus on:
    1. Mandatory requirements
    2. Technical specifications
    3. Compliance criteria
    4. Evaluation metrics
    5. Budget constraints
    6. Timeline requirements
    7. Required certifications or qualifications
    8. Key deliverables

    Format your response as a concise bullet-point list of the most important requirements.` :
    
    `Analyze this company document and extract ONLY the key capabilities, strengths, and qualifications.
    Focus on:
    1. Core competencies
    2. Technical capabilities
    3. Past experience and success stories
    4. Certifications and qualifications
    5. Unique selling points
    6. Team expertise
    7. Methodologies and approaches

    Format your response as a concise bullet-point list of the most important capabilities.`;

  try {
    console.log(`Processing ${isSourceDoc ? 'source' : 'company'} document: ${doc.title}`);
    
    let result;
    
    // Handle PDF documents differently than text documents
    if (doc.binaryData && doc.metadata?.fileType === 'application/pdf') {
      // For PDF documents, use the binary data
      result = await retryWithExponentialBackoff(() => 
        model.generateContent([
          { text: promptText },
          { 
            inlineData: {
              mimeType: 'application/pdf',
              data: Buffer.from(doc.binaryData!).toString('base64')
            }
          }
        ])
      );
    } else {
      // For text documents, use the text content
      const content = typeof doc.content === 'string' 
        ? doc.content
        : "Content not available in text format";
        
      result = await retryWithExponentialBackoff(() => 
        model.generateContent(`${promptText}\n\nDocument content:\n${content}`)
      );
    }
    
    const analysis = result.response.text();
    const formattedAnalysis = `## ${doc.title}\n${analysis}\n`;
    
    // Store the summary for future use
    global.documentSummaries[doc.id] = formattedAnalysis;
    console.log(`Saved summary for document: ${doc.title}`);
    
    return formattedAnalysis;
  } catch (error: any) {
    console.error(`Error processing document ${doc.title}:`, error);
    const errorMessage = `## ${doc.title}\nError analyzing this document: ${error.message || 'Unknown error'}\n`;
    
    // Store the error message as the summary to avoid retrying
    global.documentSummaries[doc.id] = errorMessage;
    
    return errorMessage;
  }
}

// Generate the final tender based on requirements and capabilities
async function generateTender(requirementsAnalysis: string, capabilitiesAnalysis: string, prompt: string): Promise<ReadableStream> {
  // Use Gemini Flash for the final tender generation
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
  
  const systemPrompt = `You are an expert tender writer with extensive experience in creating successful tender documents. 
  Your task is to write a professional and compelling tender document based on the user's requirements, the provided source documents, and the company's capabilities.
  
  Follow these guidelines:
  1. Use clear, concise, and professional language
  2. Structure the document with proper headings (using Markdown h1-h3)
  3. Include all necessary sections:
     - Executive Summary
     - Company Background
     - Project Understanding
     - Methodology
     - Timeline
     - Resource Allocation
     - Budget Overview
     - Quality Assurance
     - Risk Management
  4. Ensure compliance with standard tender requirements
  5. Use specific, measurable, and achievable statements
  6. Include relevant metrics and KPIs where appropriate
  7. Address ALL requirements and criteria from the source documents
  8. Highlight the company's capabilities and strengths that are relevant to the tender requirements
  9. Demonstrate how the company's experience and qualifications make it the ideal candidate for the project
  
  Format the output in clean Markdown, using appropriate heading levels (# for main sections, ## for subsections).
  
  IMPORTANT: Use the specific information from the company documents to fill in details about the company's capabilities, experience, and qualifications. Do not use placeholders like "[Your Company Name]" or "[mention relevant core competencies]". Instead, use the actual information provided in the company documents.`;

  const messages = [
    { text: systemPrompt },
    { text: `Requirements Analysis:\n${requirementsAnalysis}` },
    { text: `Company Capabilities:\n${capabilitiesAnalysis}` },
    { text: prompt || "Generate a comprehensive tender document based on the provided company information" }
  ];
  
  console.log('Generating final tender document...');
  const result = await retryWithExponentialBackoff(() => 
    model.generateContentStream(messages)
  );
  
  console.log('Streaming tender content...');
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          controller.enqueue(encoder.encode(text));
        }
        console.log('Tender generation completed successfully');
        controller.close();
      } catch (error) {
        console.error('Error in streaming tender content:', error);
        controller.error(error);
      }
    }
  });
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    // Validate inputs
    if (!prompt) {
      return new Response('Prompt is required', { status: 400 });
    }

    // Log the request details
    console.log('Tender generation request received:');
    console.log(`- Prompt length: ${prompt.length} characters`);
    
    // Directly access source and company documents from global storage
    const sourceDocuments = global.sourceDocuments || [];
    const companyDocuments = global.companyDocuments || [];
    
    console.log(`- Source documents: ${sourceDocuments.length}`);
    console.log(`- Company documents: ${companyDocuments.length}`);

    // Log document details for debugging
    if (sourceDocuments.length > 0) {
      console.log('Source documents:');
      sourceDocuments.forEach((doc, index) => {
        console.log(`  ${index + 1}. ${doc.title} (${doc.metadata?.fileSize || 0} bytes)`);
      });
    } else {
      console.warn('No source documents available');
    }
    
    if (companyDocuments.length > 0) {
      console.log('Company documents:');
      companyDocuments.forEach((doc, index) => {
        console.log(`  ${index + 1}. ${doc.title} (${doc.metadata?.fileSize || 0} bytes)`);
      });
    } else {
      console.warn('No company documents available');
    }

    try {
      // Step 1: Process source documents one by one
      console.log('Step 1: Analyzing source documents...');
      let requirementsAnalysis = '';
      
      if (sourceDocuments.length > 0) {
        for (const doc of sourceDocuments) {
          const analysis = await processDocument(doc, true);
          requirementsAnalysis += analysis;
        }
      } else {
        requirementsAnalysis = "No source documents provided. Generate a generic tender document.";
      }
      
      // Step 2: Process company documents one by one
      console.log('Step 2: Analyzing company documents...');
      let capabilitiesAnalysis = '';
      
      if (companyDocuments.length > 0) {
        for (const doc of companyDocuments) {
          const analysis = await processDocument(doc, false);
          capabilitiesAnalysis += analysis;
        }
      } else {
        capabilitiesAnalysis = "No company documents provided. Use generic company capabilities.";
      }
      
      // Log the summaries for debugging
      console.log('Document summaries generated:');
      console.log(`- Source document summaries: ${requirementsAnalysis.length} characters`);
      console.log(`- Company document summaries: ${capabilitiesAnalysis.length} characters`);
      
      // Step 3: Generate the final tender document using the summaries
      console.log('Step 3: Generating final tender document...');
      const stream = await generateTender(requirementsAnalysis, capabilitiesAnalysis, prompt);
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked'
        }
      });
    } catch (error: any) {
      console.error('Error from Gemini API:', error);
      
      // Provide more specific error messages based on the error status
      let errorMessage = 'Unknown error occurred';
      
      if (error.status === 429) {
        errorMessage = 'API rate limit exceeded. Please try again later.';
      } else if (error.status === 403) {
        errorMessage = 'API authentication error. Please check your API key.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return new Response(`Error from AI model: ${errorMessage}`, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in tender generation:', error);
    return new Response(`Error generating tender document: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}