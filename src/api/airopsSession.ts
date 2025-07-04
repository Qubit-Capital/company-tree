// Server-side API simulation for Airops deck processing
// In a real deployment, this would be actual server endpoints

export interface AiropsRequest {
  deck_url: string;
}

export interface AiropsResponse {
  success: boolean;
  outputs?: {
    pitch_text: string;
  };
  data?: any;
  error?: string;
}

// Simulated server-side Airops API call
// In production, this would be an actual backend endpoint that handles API keys securely

export async function processAiropsDeck(request: AiropsRequest): Promise<AiropsResponse> {
  console.log('🔐 Calling backend to process deck with Airops...', request.deck_url);
  
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
    
    const response = await fetch('http://localhost:3003/api/process-deck', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend API error: ${response.status} - ${errorText}`);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Received response from backend:', JSON.stringify(data).substring(0, 100) + '...');
    
    if (data.error) {
      console.error('Backend returned error:', data.error);
      throw new Error(data.error);
    }

    // Validate response structure
    if (!data.success || !data.outputs || !data.outputs.pitch_text) {
      console.error('Invalid response structure from backend:', data);
      throw new Error('Invalid response format from backend');
    }

    return {
      success: true,
      outputs: data.outputs,
      data: data
    };
  } catch (error) {
    // Handle timeout errors specifically
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Airops processing timed out after 60 seconds');
      return {
        success: false,
        error: 'Processing timed out. The file may be too large or in an unsupported format.'
      };
    }
    
    console.error('❌ Airops processing failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}