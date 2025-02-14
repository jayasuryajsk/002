"use client"

import { useState } from "react"
import type { TenderDocument, TenderSection } from "../agents/types"

export function useTenderAgents() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentSection, setCurrentSection] = useState<string | null>(null)

  const generateTender = async (tender: TenderDocument): Promise<TenderDocument> => {
    setIsProcessing(true)
    try {
      const response = await fetch("/api/tender", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tender),
      })

      if (!response.ok) {
        throw new Error("Failed to generate tender")
      }

      return await response.json()
    } finally {
      setIsProcessing(false)
      setCurrentSection(null)
    }
  }

  const processSection = async (tender: TenderDocument, sectionTitle: string): Promise<TenderSection> => {
    setIsProcessing(true)
    setCurrentSection(sectionTitle)
    try {
      const response = await fetch("/api/tender/section", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tender, sectionTitle }),
      })

      if (!response.ok) {
        throw new Error("Failed to process section")
      }

      return await response.json()
    } finally {
      setIsProcessing(false)
      setCurrentSection(null)
    }
  }

  return {
    generateTender,
    processSection,
    isProcessing,
    currentSection,
  }
}

