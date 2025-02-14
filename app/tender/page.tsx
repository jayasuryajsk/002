"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AgentProgressCards } from "@/components/AgentProgressCards"
import { useTenderAgents } from "@/lib/hooks/use-tender-agents"
import type { TenderDocument } from "@/lib/agents/types"

export default function TenderWriterPage() {
  const { generateTender, isProcessing } = useTenderAgents()
  const [agents, setAgents] = useState([
    { name: "Researcher", status: "idle", progress: 0, description: "Ready to analyze requirements" },
    { name: "Writer", status: "idle", progress: 0, description: "Ready to generate content" },
    { name: "Compliance", status: "idle", progress: 0, description: "Ready to check requirements" },
  ])

  const [tender, setTender] = useState<TenderDocument | null>(null)

  const updateAgentProgress = (
    name: string,
    status: "idle" | "working" | "completed" | "error",
    progress: number,
    description: string,
  ) => {
    setAgents((prevAgents) =>
      prevAgents.map((agent) => (agent.name === name ? { ...agent, status, progress, description } : agent)),
    )
  }

  const handleGenerateTender = async () => {
    const initialTender: TenderDocument = {
      id: "tender-" + Date.now(),
      title: "New Tender Document",
      sections: [
        { title: "Executive Summary", requirements: ["Overview", "Key Points"], content: "", status: "draft" },
        { title: "Technical Approach", requirements: ["Methodology", "Timeline"], content: "", status: "draft" },
        { title: "Pricing", requirements: ["Budget Breakdown", "Cost Justification"], content: "", status: "draft" },
      ],
      compliance: {
        requirements: ["All sections completed", "Within page limit"],
        checklist: {},
      },
    }

    updateAgentProgress("Researcher", "working", 0, "Analyzing tender requirements")

    try {
      const completedTender = await generateTender(initialTender)
      setTender(completedTender)

      // Simulate progress updates (in a real scenario, these would come from the actual agents)
      updateAgentProgress("Researcher", "completed", 100, "Requirements analyzed")
      updateAgentProgress("Writer", "completed", 100, "Content generated")
      updateAgentProgress("Compliance", "completed", 100, "All requirements met")
    } catch (error) {
      console.error("Error generating tender:", error)
      updateAgentProgress("Researcher", "error", 50, "Error during analysis")
      updateAgentProgress("Writer", "error", 30, "Content generation failed")
      updateAgentProgress("Compliance", "error", 0, "Compliance check not started")
    }
  }

  useEffect(() => {
    if (isProcessing) {
      updateAgentProgress("Writer", "working", 30, "Generating tender content")
      updateAgentProgress("Compliance", "working", 0, "Waiting for content")
    }
  }, [isProcessing, updateAgentProgress]) // Added updateAgentProgress to dependencies

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Tender Writer</h1>
      <Button onClick={handleGenerateTender} disabled={isProcessing}>
        {isProcessing ? "Generating..." : "Generate Tender"}
      </Button>
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Agent Progress</h2>
        <AgentProgressCards agents={agents} />
      </div>
      {tender && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Generated Tender</h2>
          <pre className="bg-gray-100 p-4 rounded-lg overflow-auto">{JSON.stringify(tender, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

