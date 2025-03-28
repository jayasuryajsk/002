import { NextResponse } from "next/server"
import { LlamaCloudOrchestrator } from "@/lib/agents/core/llama-cloud-orchestrator"
import type { TenderDocument } from "@/lib/agents/types"

export async function POST(req: Request) {
  try {
    const tender: TenderDocument = await req.json()
    const orchestrator = new LlamaCloudOrchestrator()
    const completedTender = await orchestrator.start(tender)

    return NextResponse.json(completedTender)
  } catch (error) {
    console.error("Tender generation error:", error)
    return NextResponse.json({ error: "Failed to generate tender document" }, { status: 500 })
  }
}

