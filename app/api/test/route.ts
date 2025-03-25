import { NextResponse } from 'next/server';

export async function GET() {
  console.log('Root Test API: GET request received');
  return NextResponse.json({ message: 'Root test endpoint is working!' });
}

export async function POST(request: Request) {
  console.log('Root Test API: POST request received');
  
  try {
    const body = await request.json();
    return NextResponse.json({ 
      message: 'Root test POST endpoint is working!',
      receivedData: body
    });
  } catch (error) {
    console.error('Error in root test POST:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 400 }
    );
  }
} 