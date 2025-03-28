import https from 'https';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''; // Use environment variable

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  error?: {
    message: string;
  };
}

// Method 1: Using as URL parameter
const testMethod1 = (): void => {
  console.log('Testing with URL parameter method:');
  const options1: https.RequestOptions = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const data = JSON.stringify({
    contents: [{
      parts: [{ text: "Explain how AI works" }]
    }]
  });

  const req1 = https.request(options1, (res) => {
    console.log(`Status Code (URL param): ${res.statusCode}`);
    
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log('Response with URL param:');
      try {
        const parsedResponse = JSON.parse(responseData) as GeminiResponse;
        console.log(parsedResponse);
      } catch (e) {
        console.log(responseData);
      }
      
      // Now try Method 2
      testMethod2();
    });
  });

  req1.on('error', (error: Error) => {
    console.error('Error with URL param:', error);
  });

  req1.write(data);
  req1.end();
};

// Method 2: Using Authorization header
const testMethod2 = (): void => {
  console.log('\nTesting with Authorization header method:');
  const options2: https.RequestOptions = {
    hostname: 'generativelanguage.googleapis.com',
    path: '/v1beta/models/gemini-2.0-flash:generateContent',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
  };

  const data = JSON.stringify({
    contents: [{
      parts: [{ text: "Explain how AI works" }]
    }]
  });

  const req2 = https.request(options2, (res) => {
    console.log(`Status Code (Auth header): ${res.statusCode}`);
    
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log('Response with Auth header:');
      try {
        const parsedResponse = JSON.parse(responseData) as GeminiResponse;
        console.log(parsedResponse);
      } catch (e) {
        console.log(responseData);
      }
    });
  });

  req2.on('error', (error: Error) => {
    console.error('Error with Auth header:', error);
  });

  req2.write(data);
  req2.end();
};

// Start the test
testMethod1(); 