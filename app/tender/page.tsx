"use client"

import { useState, useEffect } from "react"
import { TipTapEditor } from "@/components/TipTapEditor"
import { useTenderAgents } from "@/lib/hooks/use-tender-agents"
import type { TenderDocument } from "@/lib/agents/types"

export default function TenderWriterPage() {
  const { generateTender, isProcessing } = useTenderAgents()
  const [content, setContent] = useState("")
  const [tender, setTender] = useState<TenderDocument | null>(null)
  const [agentProgress, setAgentProgress] = useState({
    Researcher: { status: "idle", progress: 0, message: "" },
    Writer: { status: "idle", progress: 0, message: "" },
    Compliance: { status: "idle", progress: 0, message: "" },
  })

  const updateAgentProgress = (
    agent: string,
    status: string,
    progress: number,
    message: string
  ) => {
    setAgentProgress((prev) => ({
      ...prev,
      [agent]: { status, progress, message },
    }))
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
  }, [isProcessing])

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="flex-1 bg-white">
        <TipTapEditor
          content={content}
          onChange={setContent}
          className="h-full"
          placeholder="Start writing your tender document..."
        />
      </div>
      <div className="h-[60px] border-t bg-white px-4 flex items-center">
        <div className="flex-1 flex gap-4">
          {Object.entries(agentProgress).map(([agent, { status, progress, message }]) => (
            <div key={agent} className="flex items-center gap-2">
              <span className="text-sm font-medium">{agent}:</span>
              <span className="text-sm text-gray-600">{message}</span>
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={handleGenerateTender}
          disabled={isProcessing}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {isProcessing ? "Generating..." : "Generate Tender"}
        </button>
      </div>
    </div>
  )
}

