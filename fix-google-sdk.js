// Testing Google Generative AI SDK
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testSDK() {
  try {
    const apiKey = 'AIzaSyB-WtsHGX6L3r1n8RJk614AhaeQ4GBFZdo';
    console.log("Testing with API key:", apiKey.substring(0, 10) + "...");
    
    // Create the Generative AI instance with the API key
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Get the model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash"
    });
    
    // Generate content
    console.log("Generating content...");
    const result = await model.generateContent("Explain how AI works in one sentence");
    
    // Print the result
    console.log("Generation successful!");
    console.log("Response:", result.response.text());
  } catch (error) {
    console.error("Error:", error);
  }
}

testSDK(); 