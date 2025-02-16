import { OpenRouter } from '@openrouter/ai-sdk-provider'

export async function POST(req: Request) {
  try {
    const { text } = await req.json()
    console.log('Received text for prediction:', text)

    // Don't make API call for very short text
    if (text.length < 3) {
      console.log('Text too short, skipping prediction')
      return Response.json('')
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Text Prediction',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct',
        messages: [
          {
            role: 'system',
            content: 'You are a text completion AI. Complete the user\'s text naturally, continuing their exact thought. Only provide the direct continuation, no meta commentary or prefixes.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 10,
        top_p: 1,
        stream: false
      }),
    })

    console.log('API Response status:', response.status)
    const responseText = await response.text()
    console.log('Raw API Response:', responseText)

    if (!response.ok) {
      console.error('OpenRouter API error:', responseText)
      return Response.json('')
    }

    try {
      const result = JSON.parse(responseText)
      console.log('Parsed API Response:', result)

      const completion = result.choices?.[0]?.message?.content?.trim() || ''
      console.log('Extracted completion:', completion)

      // Clean up the completion
      const cleanCompletion = completion
        .replace(/^["'`]|["'`]$/g, '') // Remove quotes at start/end
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .split(/[.!?]/, 1)[0] // Take only the first sentence
        .trim()

      console.log('Final cleaned completion:', cleanCompletion)
      return Response.json(cleanCompletion)
    } catch (parseError) {
      console.error('Error parsing API response:', parseError)
      return Response.json('')
    }
  } catch (error) {
    console.error('Error in prediction:', error)
    return Response.json('')
  }
} 