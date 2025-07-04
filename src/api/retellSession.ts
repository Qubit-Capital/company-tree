// Server-side API simulation for Retell session management
// In a real deployment, this would be actual server endpoints

export interface RetellSessionRequest {
  agent_id: string;
  founder_name: string;
  pitch_deck_text: string;
}

export interface RetellSessionResponse {
  call_id: string;
  access_token: string;
  agent_id: string;
  success: boolean;
  error?: string;
}

export interface TranscriptRequest {
  call_id: string;
  agent_id: string;
  caller_email: string;
  call_duration: string;
}

export interface TranscriptResponse {
  transcript: string;
  success: boolean;
  error?: string;
}

// Simulated server-side Retell API calls
// In production, these would be actual backend endpoints that handle API keys securely

export async function createRetellSession(request: RetellSessionRequest): Promise<RetellSessionResponse> {
  console.log('🔐 Calling backend to create Retell session...');
  
  try {
    const response = await fetch('http://localhost:3003/api/retell-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    return {
      ...data,
      success: true
    };
  } catch (error) {
    console.error('❌ Retell session creation failed:', error);
    return {
      call_id: '',
      access_token: '',
      agent_id: request.agent_id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function getCallTranscript(request: TranscriptRequest): Promise<TranscriptResponse> {
  console.log('🔐 Calling backend to fetch call transcript...');
  
  try {
    const response = await fetch('http://localhost:3003/api/get-transcript', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    return {
      ...data,
      success: true
    };
  } catch (error) {
    console.error('❌ Transcript fetch failed:', error);
    return {
      transcript: `Session completed. Call ID: ${request.call_id}`,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}