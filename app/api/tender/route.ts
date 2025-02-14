import { NextResponse } from "next/server"
import { TenderOrchestrator } from "@/lib/agents/orchestrator"
import type { TenderDocument } from "@/lib/agents/types"

export async function POST(req: Request) {
  try {
    const tender: TenderDocument = await req.json()
    const orchestrator = new TenderOrchestrator(tender)
    const completedTender = await orchestrator.generateCompleteTender()

    return NextResponse.json(completedTender)
  } catch (error) {
    console.error("Tender generation error:", error)
    return NextResponse.json({ error: "Failed to generate tender document" }, { status: 500 })
  }
}

