import React, { useState, useEffect, useRef } from 'react';
import { Mic, CheckCircle, AlertCircle, Link, FileText, Clock, Volume2, VolumeX, Code, RefreshCw } from 'lucide-react';
import { RetellWebClient } from 'retell-client-js-sdk';
import { createRetellSession, getCallTranscript, RetellSessionRequest, RetellSessionResponse, TranscriptRequest } from './api/retellSession';
import { processAiropsDeck, AiropsRequest, AiropsResponse } from './api/airopsSession';
import { apiCallWithRetry } from './utils/apiRetry';

// Define application states
type AppState = 'landing' | 'processing' | 'ready' | 'calling' | 'summary';

// Define session data structure
interface SessionData {
  callId: string;
  agentId: string;
  founderName: string;
  callDuration: string;
  transcript: string;
}

function App() {
  // Main state variables
  const [currentState, setCurrentState] = useState<AppState>('landing');
  const [founderName, setFounderName] = useState<string>('');
  const [driveLink, setDriveLink] = useState<string>('');
  const [pitchDeckText, setPitchDeckText] = useState<string>('');
  const [processedDeckData, setProcessedDeckData] = useState<any>(null);
  const [retellSessionData, setRetellSessionData] = useState<RetellSessionResponse | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  
  // UI state variables
  const [error, setError] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isOnCall, setIsOnCall] = useState<boolean>(false);
  const [callTime, setCallTime] = useState<number>(0);
  const [isStartingCall, setIsStartingCall] = useState<boolean>(false);
  const [showDeveloperMode, setShowDeveloperMode] = useState<boolean>(false);
  
  // Refs for resource management
  const callTimerRef = useRef<number | null>(null);
  const retellClientRef = useRef<RetellWebClient | null>(null);
  const callIdRef = useRef<string | null>(null);
  const apiCallMadeRef = useRef<boolean>(false);

  // Validate Google Drive URL format
  const isValidDriveLink = (url: string): boolean => {
    if (!url.trim()) return true; // Empty is valid (optional)
    const driveRegex = /^https:\/\/drive\.google\.com\/(file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/;
    return driveRegex.test(url);
  };
  
  // Handle form submission from landing page
  const handleStart = async () => {
    if (!founderName.trim()) {
      setError('Please enter your name.');
      return;
    }
    
    if (driveLink && !isValidDriveLink(driveLink)) {
      setError('Please enter a valid Google Drive link or leave it empty.');
      return;
    }
    
    setError(null);
    
    if (driveLink) {
      // Process the pitch deck if a link is provided
      setCurrentState('processing');
      await processPitchDeck();
    } else {
      // Skip processing if no deck link
      setCurrentState('ready');
    }
  };
  
  // Process pitch deck using Airops API
  const processPitchDeck = async () => {
    try {
      setProcessingProgress(10);
      console.log("Starting pitch deck processing with URL:", driveLink);
      
      const request: AiropsRequest = {
        deck_url: driveLink
      };
      
      setProcessingProgress(30);
      console.log("Sending request to backend for Airops processing");
      
      const response = await apiCallWithRetry<AiropsResponse>(
        async () => await processAiropsDeck(request),
        { maxAttempts: 3 }
      );
      
      console.log("Received response from Airops:", response);
      setProcessingProgress(70);
      
      if (!response.success) {
        console.error("Airops processing failed with error:", response.error);
        throw new Error(response.error || 'Failed to process pitch deck');
      }
      
      if (!response.outputs || !response.outputs.pitch_text) {
        console.error("Airops response missing expected data structure:", response);
        throw new Error('Invalid response format from pitch deck processing');
      }
      
      console.log("Successfully processed pitch deck, text length:",
                 response.outputs.pitch_text.length);
      
      setPitchDeckText(response.outputs.pitch_text);
      setProcessedDeckData(response.data);
      
      setProcessingProgress(100);
      
      // Move to ready state after processing
      setTimeout(() => {
        setCurrentState('ready');
      }, 500);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error processing deck';
      setError(errorMessage);
      console.error('Pitch deck processing error:', err);
      
      // Provide more helpful error message to the user
      if (errorMessage.includes('API key')) {
        setError('Server configuration error: API key issue. Please contact support.');
      } else if (errorMessage.includes('access') || errorMessage.includes('permission')) {
        setError('The pitch deck file may not be publicly accessible. Please ensure the Google Drive file is shared with "Anyone with the link".');
      } else {
        setError(`Failed to process deck: ${errorMessage}. Please try a different file or format.`);
      }
      
      // Allow retry from landing page
      setCurrentState('landing');
    }
  };
  
  // Start call with Retell
  const startCall = async () => {
    try {
      setIsStartingCall(true);
      setError(null);
      
      // Create Retell session
      const request: RetellSessionRequest = {
        agent_id: 'agent_b795ddf35c70722141b715a820', // From architecture doc
        founder_name: founderName,
        pitch_deck_text: pitchDeckText || 'No pitch deck provided'
      };
      
      const sessionResponse = await apiCallWithRetry<RetellSessionResponse>(
        async () => await createRetellSession(request),
        { maxAttempts: 3 }
      );
      
      if (!sessionResponse.success) {
        throw new Error(sessionResponse.error || 'Failed to create call session');
      }
      
      setRetellSessionData(sessionResponse);
      callIdRef.current = sessionResponse.call_id;
      
      // Initialize Retell client
      const retellClient = new RetellWebClient();
      
      retellClientRef.current = retellClient;
      
      // Start the call with the actual Retell client
      // First, set up event listeners
      retellClient.on('disconnect', handleCallDisconnected);
      retellClient.on('error', handleRetellError);
      
      // Start the call with the correct parameters
      await retellClient.startCall({
        accessToken: sessionResponse.access_token,
        // Optional parameters for better audio experience
        sampleRate: 16000,
        emitRawAudioSamples: true
      });
      
      console.log(`Call started with ID: ${sessionResponse.call_id}`);
      
      // Update UI state
      setIsOnCall(true);
      setCurrentState('calling');
      
      // Start call timer
      startCallTimer();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error starting call';
      setError(errorMessage);
      console.error('Call start error:', err);
      setIsStartingCall(false);
    }
  };
  
  // Start call timer
  const startCallTimer = () => {
    setCallTime(0);
    callTimerRef.current = window.setInterval(() => {
      setCallTime(prevTime => prevTime + 1);
    }, 1000);
  };
  
  // Format call time as MM:SS
  const formatCallTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Toggle mute state
  const toggleMute = () => {
    if (retellClientRef.current) {
      if (isMuted) {
        retellClientRef.current.unmute();
      } else {
        retellClientRef.current.mute();
      }
      setIsMuted(!isMuted);
    }
  };
  
  // Handle call disconnection
  const handleCallDisconnected = () => {
    console.log('Call disconnected');
    endCall();
  };
  
  // Handle Retell errors
  const handleRetellError = (error: any) => {
    console.error('Retell error:', error);
    setError(`Call error: ${error.message || 'Unknown error'}`);
    endCall();
  };
  
  // End call and fetch transcript
  const endCall = async () => {
    try {
      // Stop timer
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      
      // Disconnect call
      if (retellClientRef.current) {
        try {
          await retellClientRef.current.stopCall();
        } catch (e) {
          console.warn('Error stopping call:', e);
        }
        retellClientRef.current = null;
      }
      
      // Reset call state
      setIsOnCall(false);
      setIsMuted(false);
      
      // Get call duration
      const duration = formatCallTime(callTime);
      
      // Fetch transcript if we have a call ID
      if (callIdRef.current) {
        const transcriptRequest: TranscriptRequest = {
          call_id: callIdRef.current,
          agent_id: 'agent_b795ddf35c70722141b715a820',
          caller_email: `${founderName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
          call_duration: duration
        };
        
        const transcriptResponse = await apiCallWithRetry(
          async () => await getCallTranscript(transcriptRequest),
          { maxAttempts: 2 }
        );
        
        // Save session data
        setSessionData({
          callId: callIdRef.current,
          agentId: 'agent_b795ddf35c70722141b715a820',
          founderName: founderName,
          callDuration: duration,
          transcript: transcriptResponse.transcript
        });
      }
      
      // Move to summary state
      setCurrentState('summary');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error ending call';
      setError(errorMessage);
      console.error('Call end error:', err);
      
      // Force move to summary even on error
      setCurrentState('summary');
    }
  };
  
  // Reset the application
  const reset = () => {
    setCurrentState('landing');
    setFounderName('');
    setDriveLink('');
    setPitchDeckText('');
    setProcessedDeckData(null);
    setRetellSessionData(null);
    setSessionData(null);
    setError(null);
    setProcessingProgress(0);
    setCallTime(0);
    setIsOnCall(false);
    setIsMuted(false);
    setIsStartingCall(false);
    callIdRef.current = null;
    apiCallMadeRef.current = false;
  };
  
  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      if (retellClientRef.current) {
        try {
          retellClientRef.current.stopCall();
          console.log('Call stopped during cleanup');
        } catch (error) {
          console.error('Error stopping call during cleanup:', error);
        }
        retellClientRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* LANDING STATE */}
        {currentState === 'landing' && (
          <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Practice Your Pitch</h1>
              <p className="text-gray-600 mt-2">Enter your details to get started.</p>
            </div>
            
            {/* Founder Name Input */}
            <div className="mb-4">
              <label htmlFor="founder-name" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="founder-name"
                value={founderName}
                onChange={(e) => setFounderName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Pitch Deck Link Input */}
            <div className="mb-4">
              <label htmlFor="deck-link" className="block text-sm font-medium text-gray-700 mb-1">
                Pitch Deck Link <span className="text-gray-500">(optional)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="deck-link"
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                  placeholder="Google Drive link to your pitch deck"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <Link className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Share a Google Drive link to your pitch deck for personalized feedback
              </p>
            </div>
            
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm mb-4">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            {/* Developer Mode Toggle */}
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="developer-mode"
                checked={showDeveloperMode}
                onChange={() => setShowDeveloperMode(!showDeveloperMode)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="developer-mode" className="ml-2 block text-sm text-gray-700">
                Developer Mode
              </label>
            </div>
            
            {/* Start Button */}
            <button
              onClick={handleStart}
              disabled={!founderName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Start
            </button>
          </div>
        )}
        
        {/* PROCESSING STATE */}
        {currentState === 'processing' && (
          <div className="bg-white p-8 rounded-xl shadow-lg text-center">
            <RefreshCw className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-bold text-gray-900">Processing Your Pitch Deck</h2>
            <p className="text-gray-600 mt-2">Please wait while we analyze your deck...</p>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-6 mb-2">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${processingProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500">{processingProgress}% complete</p>
            
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm mt-4">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* READY STATE */}
        {currentState === 'ready' && (
          <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="text-center mb-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Ready to Practice, {founderName}!</h2>
              
              {driveLink && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-left">
                  <div className="flex items-center gap-2 text-gray-700 font-medium mb-1">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span>Pitch Deck Processed</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Your pitch deck has been analyzed and will be used to personalize your practice session.
                  </p>
                </div>
              )}
              
              {/* Developer Mode Details */}
              {showDeveloperMode && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-left">
                  <div className="flex items-center gap-2 text-gray-700 font-medium mb-1">
                    <Code className="w-5 h-5 text-purple-600" />
                    <span>Developer Details</span>
                  </div>
                  <div className="text-xs font-mono bg-gray-100 p-2 rounded max-h-32 overflow-y-auto">
                    <p>Pitch Text Length: {pitchDeckText.length} chars</p>
                    <p>Agent ID: agent_b795ddf35c70722141b715a820</p>
                    {processedDeckData && (
                      <p>API Response: {JSON.stringify(processedDeckData).substring(0, 100)}...</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Start Call Button */}
            <button
              onClick={startCall}
              disabled={isStartingCall}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
            >
              {isStartingCall ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Start Practice Session'
              )}
            </button>
            
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm mt-4">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* CALLING STATE */}
        {currentState === 'calling' && (
          <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="text-center mb-6">
              <Mic className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl font-bold text-gray-900">Practice Session Active</h2>
              
              {/* Call Timer */}
              <div className="flex items-center justify-center gap-2 mt-2 text-gray-600">
                <Clock className="w-5 h-5" />
                <span className="font-mono">{formatCallTime(callTime)}</span>
              </div>
            </div>
            
            {/* Call Controls */}
            <div className="flex gap-3 mb-6">
              {/* Mute Button */}
              <button
                onClick={toggleMute}
                className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  isMuted
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-5 h-5" />
                    <span>Unmute</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-5 h-5" />
                    <span>Mute</span>
                  </>
                )}
              </button>
            </div>
            
            {/* End Call Button */}
            <button
              onClick={endCall}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              End Call
            </button>
            
            {/* Developer Mode Details */}
            {showDeveloperMode && retellSessionData && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-left">
                <div className="flex items-center gap-2 text-gray-700 font-medium mb-1">
                  <Code className="w-5 h-5 text-purple-600" />
                  <span>Call Details</span>
                </div>
                <div className="text-xs font-mono bg-gray-100 p-2 rounded max-h-32 overflow-y-auto">
                  <p>Call ID: {retellSessionData.call_id}</p>
                  <p>Agent ID: {retellSessionData.agent_id}</p>
                  <p>Status: {isOnCall ? 'Connected' : 'Connecting...'}</p>
                </div>
              </div>
            )}
            
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm mt-4">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* SUMMARY STATE */}
        {currentState === 'summary' && (
          <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="text-center mb-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900">Session Complete!</h1>
              <p className="text-gray-600 mt-2">Great job, {founderName}!</p>
              
              {/* Call Duration */}
              {sessionData && (
                <div className="flex items-center justify-center gap-2 mt-2 text-gray-600">
                  <Clock className="w-5 h-5" />
                  <span>Call Duration: {sessionData.callDuration}</span>
                </div>
              )}
            </div>
            
            {/* Transcript */}
            {sessionData && sessionData.transcript && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Conversation Transcript</h3>
                <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                    {sessionData.transcript}
                  </pre>
                </div>
              </div>
            )}
            
            {/* Start New Session Button */}
            <button
              onClick={reset}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Start New Session
            </button>
            
            {/* Developer Mode Details */}
            {showDeveloperMode && sessionData && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-left">
                <div className="flex items-center gap-2 text-gray-700 font-medium mb-1">
                  <Code className="w-5 h-5 text-purple-600" />
                  <span>Session Details</span>
                </div>
                <div className="text-xs font-mono bg-gray-100 p-2 rounded max-h-32 overflow-y-auto">
                  <p>Call ID: {sessionData.callId}</p>
                  <p>Agent ID: {sessionData.agentId}</p>
                  <p>Duration: {sessionData.callDuration}</p>
                  <p>Transcript Length: {sessionData.transcript.length} chars</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;