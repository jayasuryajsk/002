import { google } from "@ai-sdk/google"
import { Message as AIMessage } from "ai"

export type Message = {
  role: "user" | "assistant"
  content: string
  type?: "text" | "file" | "selected-text"
  fileDetails?: {
    name: string
    url: string
    contentType?: string
  }
  selectedText?: string
  selectionInfo?: {
    lines?: string
    context?: string
    startLine?: number
    endLine?: number
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
      try {
        console.log(`Attempting to fetch PDF with ID: ${fileId}`)
        const pdfResponse = await fetch(`/api/process-pdf?fileId=${fileId}`)
        
        if (!pdfResponse.ok) {
          console.error(`Failed to fetch PDF content: Status ${pdfResponse.status}`)
          console.error(`Error details: ${await pdfResponse.text().catch(() => 'No error text')}`)
          
          // Continue with the chat even if PDF retrieval fails
          onChunk("I'm unable to access the PDF file. It may have been removed or the server restarted. Please upload the PDF again.")
          
          // Create a simple text-only request instead
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              messages: [
                ...messages, 
                { role: "assistant", content: "I'm unable to access the PDF file. It may have been removed or the server restarted. Please upload the PDF again." }
              ] 
            }),
          })
          
          // Process this response as usual
          const reader = response.body?.getReader()
          if (!reader) throw new Error("No reader available")

          const decoder = new TextDecoder()
          let buffer = ""

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            // Decode the current chunk and append to our buffer
            const chunk = decoder.decode(value, { stream: true })
            console.log("Received raw chunk:", chunk)
            buffer += chunk

            // Split the buffer into lines and keep any partial line for later
            const lines = buffer.split("\n")
            buffer = lines.pop() ?? ""

            for (let line of lines) {
              line = line.trim()
              // Handle standard SSE "data:" lines if present
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim()
                if (data === "[DONE]") {
                  console.log("Stream ended (data line)")
                  break
                }
                try {
                  // Try parsing as JSON first
                  const text = JSON.parse(data)
                  onChunk(text)
                } catch (err) {
                  // If parsing fails, send the raw data
                  onChunk(data)
                }
              }
              // Handle Gemini-style text chunks with "0:" prefix
              else if (line.startsWith("0:")) {
                let text = line.slice(2).trim()
                try {
                  // Remove surrounding quotes if any
                  text = JSON.parse(text)
                } catch (e) {
                  // leave text as is if JSON parsing fails
                }
                onChunk(text)
              }
              // Optionally log metadata or finish chunks (e.g. "f:" or "e:" / "d:")
              else if (line.startsWith("f:")) {
                console.log("Metadata chunk:", line.slice(2).trim())
              }
              else if (line.startsWith("e:") || line.startsWith("d:")) {
                console.log("Finish/Error chunk:", line.slice(2).trim())
              } else {
                // Log any unexpected lines for debugging
                console.log("Unhandled line:", line)
              }
            }
          }
          return
        }
        
        const { content } = await pdfResponse.json()
        pdfContent = content
        
        // Log to verify the PDF content
        console.log("PDF content fetched, length:", (pdfContent as number[]).length)
      } catch (error) {
        console.error("Error fetching PDF:", error)
        onChunk("There was a problem accessing the PDF file. Please try uploading it again.")
        return
      }
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, pdfContent }),
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

      // Decode the current chunk and append to our buffer
      const chunk = decoder.decode(value, { stream: true })
      console.log("Received raw chunk:", chunk)
      buffer += chunk

      // Split the buffer into lines and keep any partial line for later
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (let line of lines) {
        line = line.trim()
        // Handle standard SSE "data:" lines if present
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim()
          if (data === "[DONE]") {
            console.log("Stream ended (data line)")
            break
          }
          try {
            // Try parsing as JSON first
            const text = JSON.parse(data)
            onChunk(text)
          } catch (err) {
            // If parsing fails, send the raw data
            onChunk(data)
          }
        }
        // Handle Gemini-style text chunks with "0:" prefix
        else if (line.startsWith("0:")) {
          let text = line.slice(2).trim()
          try {
            // Remove surrounding quotes if any
            text = JSON.parse(text)
          } catch (e) {
            // leave text as is if JSON parsing fails
          }
          onChunk(text)
        }
        // Optionally log metadata or finish chunks (e.g. "f:" or "e:" / "d:")
        else if (line.startsWith("f:")) {
          console.log("Metadata chunk:", line.slice(2).trim())
        }
        else if (line.startsWith("e:") || line.startsWith("d:")) {
          console.log("Finish/Error chunk:", line.slice(2).trim())
        } else {
          // Log any unexpected lines for debugging
          console.log("Unhandled line:", line)
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
      headers: { "Content-Type": "application/json" },
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

      const chunk = decoder.decode(value, { stream: true })
      console.log("Search raw chunk:", chunk)
      buffer += chunk

      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (let line of lines) {
        line = line.trim()
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim()
          if (data === "[DONE]") continue
          try {
            const text = JSON.parse(data)
            onChunk(text)
          } catch (e) {
            onChunk(data)
          }
        } else if (line.startsWith("0:")) {
          let text = line.slice(2).trim()
          try {
            text = JSON.parse(text)
          } catch (e) {}
          onChunk(text)
        } else if (line.startsWith("e:") || line.startsWith("d:")) {
          console.log("Search finish/error chunk:", line.slice(2).trim())
        } else {
          console.log("Search unhandled line:", line)
        }
      }
    }
  } catch (error) {
    console.error("Error in search grounding:", error)
    throw error
  }
}
