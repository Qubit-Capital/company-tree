import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3003; // Changed to 3003 to avoid conflicts with existing servers

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('AI Pitch Practice Backend is running!');
});

app.post('/api/retell-session', async (req, res) => {
  const { agent_id, founder_name, pitch_deck_text } = req.body;
  const RETELL_API_KEY = process.env.RETELL_API_KEY;

  try {
    const response = await fetch('https://api.retellai.com/v2/create-web-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RETELL_API_KEY}`
      },
      body: JSON.stringify({
        agent_id: agent_id,
        metadata: {
          founder_name: founder_name,
          pitch_deck_text: pitch_deck_text,
          client: "bolt-app"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Retell API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error creating Retell session:', error);
    res.status(500).json({ success: false, error: 'Failed to create Retell session' });
  }
});

app.post('/api/get-transcript', async (req, res) => {
  const { call_id, agent_id, caller_email, call_duration } = req.body;
  const RETELL_API_KEY = process.env.RETELL_API_KEY;

  try {
    // Fetch the actual transcript from Retell's API
    const response = await fetch(`https://api.retellai.com/v2/call/${call_id}/transcript`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RETELL_API_KEY}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Retell API error: ${response.status} - ${errorText}`);
      throw new Error(`Retell API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Transcript data received:', data);
    
    // Format the transcript nicely
    let formattedTranscript = '';
    if (data.transcript && data.transcript.length > 0) {
      formattedTranscript = data.transcript.map((entry: any) => {
        const speaker = entry.speaker === 'agent' ? 'Investor' : 'Founder';
        return `${speaker}: ${entry.text}`;
      }).join('\n\n');
      
      // Add call metadata
      formattedTranscript += `\n\nCall Duration: ${call_duration}\nCall ID: ${call_id}`;
    } else {
      // Fallback if no transcript is available
      const userName = caller_email ? caller_email.split('@')[0].replace(/\./g, ' ') : 'founder';
      const formattedName = userName.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      
      formattedTranscript = `No transcript available yet for this call. The conversation is still being processed.\n\nCall Duration: ${call_duration}\nCall ID: ${call_id}`;
    }

    res.json({ transcript: formattedTranscript, success: true });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transcript',
      transcript: `Error retrieving call transcript. Please try again later.\n\nCall Duration: ${call_duration}\nCall ID: ${call_id}`
    });
  }
});

app.post('/api/process-deck', async (req, res) => {
  const { deck_url } = req.body;
  const AIROPS_API_KEY = process.env.AIROPS_API_KEY;

  try {
    // Extract the file ID from the Google Drive URL
    let fileId = deck_url;
    
    // Handle different Google Drive URL formats
    const driveUrlRegex = /^https:\/\/drive\.google\.com\/(file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/;
    const match = deck_url.match(driveUrlRegex);
    
    if (match && match[2]) {
      fileId = match[2];
    }
    
    // Try different URL formats that Airops might be able to access
    // Format 1: Direct download link
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    
    // Format 2: View link (might work better with some APIs)
    const viewUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
    
    // Format 3: Direct file ID (some APIs prefer just the ID)
    const fileIdOnly = fileId;
    
    // Use the direct download link as our primary format
    const formattedUrl = downloadUrl;
    
    console.log(`Processing deck with URL: ${formattedUrl}`);
    console.log(`Alternative formats - View URL: ${viewUrl}, File ID: ${fileIdOnly}`);
    
    // Check if API key exists
    if (!AIROPS_API_KEY) {
      throw new Error('Airops API key is not configured');
    }
    
    console.log(`Using Airops API key: ${AIROPS_API_KEY.substring(0, 5)}...`);
    
    // Prepare the request body
    const requestBody = {
      inputs: {
        deck_url: formattedUrl,
        // Add the file ID as a separate parameter in case Airops expects it differently
        file_id: fileId
      }
    };
    
    console.log(`Sending request to Airops: ${JSON.stringify(requestBody)}`);
    
    const response = await fetch('https://app.airops.com/public_api/airops_apps/9f3205b9-8b86-4cb5-8026-41ff5aaf0020/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AIROPS_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Airops API error response: ${response.status} - ${errorText}`);
      throw new Error(`Airops API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`Airops API response received: ${JSON.stringify(data).substring(0, 200)}...`);
    
    // Handle different possible response formats from Airops
    let formattedResponse;
    
    // Case 1: Standard format with outputs.pitch_text
    if (data.outputs && data.outputs.pitch_text) {
      formattedResponse = {
        success: true,
        outputs: {
          pitch_text: data.outputs.pitch_text
        },
        data: data
      };
    }
    // Case 2: Different structure with data.pitch_text
    else if (data.pitch_text) {
      formattedResponse = {
        success: true,
        outputs: {
          pitch_text: data.pitch_text
        },
        data: data
      };
    }
    // Case 3: Different structure with data.text or data.content
    else if (data.text || data.content) {
      formattedResponse = {
        success: true,
        outputs: {
          pitch_text: data.text || data.content
        },
        data: data
      };
    }
    // Case 4: Response has results array
    else if (data.results && Array.isArray(data.results) && data.results.length > 0) {
      const result = data.results[0];
      const pitchText = result.pitch_text || result.text || result.content || JSON.stringify(result);
      formattedResponse = {
        success: true,
        outputs: {
          pitch_text: pitchText
        },
        data: data
      };
    }
    // Case 5: No recognizable format, create a fallback
    else {
      console.warn("Unrecognized Airops response format, creating fallback response");
      // Create a fallback response with the raw data stringified
      formattedResponse = {
        success: true,
        outputs: {
          pitch_text: `Processed deck content: ${JSON.stringify(data).substring(0, 1000)}`
        },
        data: data
      };
    }
    
    console.log(`Sending formatted response to client: ${JSON.stringify(formattedResponse).substring(0, 100)}...`);
    res.json(formattedResponse);
  } catch (error) {
    console.error('Error processing deck:', error);
    // Pass the detailed error message back to the client
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: `Failed to process deck: ${errorMessage}`
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});