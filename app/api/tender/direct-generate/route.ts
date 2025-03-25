import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { LocalDocumentStorage } from '../../../../lib/local-storage';

// Simple direct tender generation with native PDF support
export async function POST(request: NextRequest) {
  console.log('Direct API call initiated - native PDF support');
  
  try {
    // Parse the request body
    const requestData = await request.json();
    
    const { 
      prompt = "", 
      title = "Tender Response"
    } = requestData;

    // Create a ReadableStream for streaming the response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // Initial message
          controller.enqueue(encoder.encode(`# Working on your tender\n\nProcessing documents...\n\n`));
          
          // Initialize Gemini API
          const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
          
          // Get all documents
          const companyDocs = await LocalDocumentStorage.getCompanyDocuments();
          const sourceDocs = await LocalDocumentStorage.getSourceDocuments();
          
          // Log document counts
          controller.enqueue(encoder.encode(`## Found ${companyDocs.length} company documents and ${sourceDocs.length} source documents\n\n`));
          
          // Store processed results
          const sourceResults = [];
          const companyResults = [];
          
          // Process source documents - similar to ChatGPT example
          if (sourceDocs.length > 0) {
            controller.enqueue(encoder.encode(`## Processing source documents\n\n`));
            
            for (let i = 0; i < sourceDocs.length; i++) {
              const doc = sourceDocs[i];
              try {
                controller.enqueue(encoder.encode(`Processing ${doc.title || 'Untitled'} (${i+1}/${sourceDocs.length})...\n\n`));
                
                // Analyze tender document prompt
                const analyzePrompt = "Analyze this tender document and extract the key requirements, evaluation criteria, specifications, and important details.";
                
                // Use the model directly with PDF support
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                
                const parts = [];
                
                // Add document content - either text or PDF
                if (doc.content) {
                  parts.push({ text: doc.content });
                } else if (doc.binaryData) {
                  parts.push({ 
                    inlineData: {
                      data: Buffer.from(doc.binaryData).toString("base64"),
                      mimeType: doc.metadata?.fileType || "application/pdf"
                    }
                  });
                } else {
                  continue; // Skip if no content
                }
                
                // Add the analysis prompt
                parts.push({ text: analyzePrompt });
                
                // Make API call
                const result = await model.generateContent(parts);
                const analysis = result.response.text();
                
                sourceResults.push({
                  title: doc.title || 'Untitled',
                  analysis: analysis
                });
                
                controller.enqueue(encoder.encode(`✓ Processed: ${doc.title || 'Untitled'}\n\n`));
              } catch (error: any) {
                console.error(`Error processing source document:`, error);
                controller.enqueue(encoder.encode(`⚠️ Error processing: ${doc.title || 'Untitled'} - ${error.message || 'Unknown error'}\n\n`));
              }
            }
          }
          
          // Process company documents
          if (companyDocs.length > 0) {
            controller.enqueue(encoder.encode(`## Processing company documents\n\n`));
            
            for (let i = 0; i < companyDocs.length; i++) {
              const doc = companyDocs[i];
              try {
                controller.enqueue(encoder.encode(`Processing ${doc.title || 'Untitled'} (${i+1}/${companyDocs.length})...\n\n`));
                
                // Analyze company document prompt
                const analyzePrompt = "Analyze this company document and extract the key capabilities, experience, strengths, and qualifications that would be relevant for a tender response.";
                
                // Use the model directly with PDF support
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                
                const parts = [];
                
                // Add document content - either text or PDF
                if (doc.content) {
                  parts.push({ text: doc.content });
                } else if (doc.binaryData) {
                  parts.push({ 
                    inlineData: {
                      data: Buffer.from(doc.binaryData).toString("base64"),
                      mimeType: doc.metadata?.fileType || "application/pdf"
                    }
                  });
                } else {
                  continue; // Skip if no content
                }
                
                // Add the analysis prompt
                parts.push({ text: analyzePrompt });
                
                // Make API call
                const result = await model.generateContent(parts);
                const analysis = result.response.text();
                
                companyResults.push({
                  title: doc.title || 'Untitled',
                  analysis: analysis
                });
                
                controller.enqueue(encoder.encode(`✓ Processed: ${doc.title || 'Untitled'}\n\n`));
              } catch (error: any) {
                console.error(`Error processing company document:`, error);
                controller.enqueue(encoder.encode(`⚠️ Error processing: ${doc.title || 'Untitled'} - ${error.message || 'Unknown error'}\n\n`));
              }
            }
          }
          
          // Generate final tender
          controller.enqueue(encoder.encode(`## Generating final tender document\n\n`));
          
          // Create tender generation prompt
          const tenderPrompt = `
Generate a comprehensive tender response document based on the following information:

TENDER REQUIREMENTS:
${sourceResults.map(sr => `--- ${sr.title} ---\n${sr.analysis}\n\n`).join('')}

COMPANY CAPABILITIES:
${companyResults.map(cr => `--- ${cr.title} ---\n${cr.analysis}\n\n`).join('')}

${prompt || ""}

Create a well-structured tender with sections for Executive Summary, Understanding of Requirements, Proposed Solution, Implementation Approach, Timeline, Team, Pricing, and Conclusion.
`;

          try {
            // Generate the tender document
            const finalModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const result = await finalModel.generateContent([{ text: tenderPrompt }]);
            const generatedTender = result.response.text();
            
            // Return the final result
            controller.enqueue(encoder.encode(`# ${title}\n\n`));
            controller.enqueue(encoder.encode(generatedTender));
          } catch (error: any) {
            console.error('Error generating final tender:', error);
            controller.enqueue(encoder.encode(`## Error generating final tender\n\n${error.message || 'Unknown error'}\n\n`));
            
            // Return the processed data as fallback
            controller.enqueue(encoder.encode(`# Processed Document Summaries\n\n`));
            controller.enqueue(encoder.encode(`## Tender Requirements\n\n`));
            sourceResults.forEach(sr => {
              controller.enqueue(encoder.encode(`### ${sr.title}\n\n${sr.analysis}\n\n`));
            });
            
            controller.enqueue(encoder.encode(`## Company Capabilities\n\n`));
            companyResults.forEach(cr => {
              controller.enqueue(encoder.encode(`### ${cr.title}\n\n${cr.analysis}\n\n`));
            });
          }
        } catch (error: any) {
          console.error('Error:', error);
          controller.enqueue(encoder.encode(`## Error\n\n${error.message || 'An unexpected error occurred.'}\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('Error in direct generate API handler:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
} 