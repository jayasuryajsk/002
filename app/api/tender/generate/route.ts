import { NextRequest, NextResponse } from 'next/server';
import { LlamaCloudOrchestrator } from '@/lib/agents/core/llama-cloud-orchestrator';
import fs from 'fs';
import path from 'path';

// Helper function to read API keys directly from .env file
function getDirectEnvValue(key: string): string | null {
  try {
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(new RegExp(`${key}=([^\\r\\n]+)`));
    return match ? match[1] : null;
  } catch (error) {
    console.error(`Error reading ${key} from .env file:`, error);
    return null;
  }
}

// Initialize a global orchestrator instance
let orchestratorInstance: LlamaCloudOrchestrator | null = null;

async function getOrchestrator(): Promise<LlamaCloudOrchestrator> {
  if (!orchestratorInstance) {
    orchestratorInstance = new LlamaCloudOrchestrator();
  }
  return orchestratorInstance;
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { message: "Tender generation API is available. Use POST to generate a tender document." },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  console.log("Tender Generation API: POST request received");
  
  try {
    const data = await request.json();
    console.log("Request data received:", data);
    
    const orchestrator = new LlamaCloudOrchestrator();
    
    // Start tender generation
    console.log(`Starting tender generation: "${data.title || 'Tender Document'}"`);
    
    const tender = await orchestrator.generateTender({
      title: data.title || "Tender Document",
      prompt: data.prompt,
      additionalContext: data.additionalContext,
      onProgress: (message) => {
        console.log(message);
      }
    });
    
    return NextResponse.json(tender);
  } catch (error) {
    console.error("Error in tender generation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 