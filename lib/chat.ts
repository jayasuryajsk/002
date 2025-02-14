import { google } from "@ai-sdk/google"
import { Message as AIMessage } from "ai"

export type Message = {
  role: "user" | "assistant"
  content: string
  type?: "text" | "file"
  fileDetails?: {
    name: string
    url: string
    contentType?: string
  }
}

export async function streamChat(
  messages: Message[], 
  onChunk: (chunk: string) => void,
  fileId?: string
) {
  try {
    let pdfContent: number[] | undefined

    // If there's a fileId, fetch the PDF content first
    if (fileId) {
      const pdfResponse = await fetch(`/api/process-pdf?fileId=${fileId}`)
      if (!pdfResponse.ok) {
        throw new Error("Failed to fetch PDF content")
      }
      const { content } = await pdfResponse.json()
      pdfContent = content
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        messages,
        pdfContent 
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch chat response")
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error("No reader available")

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6)
          if (data === "[DONE]") continue
          try {
            const text = JSON.parse(data)
            if (text) onChunk(text)
          } catch (e) {
            console.error("Failed to parse chunk:", e)
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in streamChat:", error)
    throw error
  }
}

export async function uploadAndProcessPDF(file: File): Promise<string> {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch("/api/process-pdf", {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    throw new Error("Failed to process PDF")
  }

  const result = await response.json()
  return result.content
}

export async function performSearchGrounding(
  query: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        messages: [{ role: "user", content: query }],
        useSearchGrounding: true 
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch search response")
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error("No reader available")

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6)
          if (data === "[DONE]") continue
          try {
            const text = JSON.parse(data)
            if (text) onChunk(text)
          } catch (e) {
            console.error("Failed to parse chunk:", e)
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in search grounding:", error)
    throw error
  }
}

