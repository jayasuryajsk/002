import { NextResponse } from 'next/server';

export async function GET() {
  console.log('Test API: GET request received');
  return NextResponse.json({ message: 'Test endpoint is working!' });
}

export async function POST(request: Request) {
  console.log('Test API: POST request received');
  
  try {
    const body = await request.json();
    return NextResponse.json({ 
      message: 'Test POST endpoint is working!',
      receivedData: body
    });
  } catch (error) {
    console.error('Error in test POST:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 400 }
    );
  }
} 