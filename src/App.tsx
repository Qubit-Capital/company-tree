import React, { useState, useRef, useEffect } from 'react';
import { Link, FileText, Mic, MicOff, Phone, PhoneOff, Clock, MessageSquare, TrendingUp, CheckCircle, AlertCircle, ExternalLink, Eye, Code, Maximize2, Minimize2, User, EyeOff, Settings, Loader2 } from 'lucide-react';
import { RetellWebClient } from 'retell-client-js-sdk';
import { apiCallWithRetry } from './utils/apiRetry';
import { createRetellSession, getCallTranscript, RetellSessionRequest, TranscriptRequest } from './api/retellSession';
import { processAiropsDeck } from './api/airopsSession';

type AppState = 'landing' | 'processing' | 'ready' | 'starting-call' | 'calling' | 'summary';

interface SessionData {
  transcript: string;
  duration: number;
  questionsAsked: number;
  topicsCovered: string[];
}

interface RetellSessionResponse {
  call_id: string;
  access_token: string;
  agent_id: string;
  success: boolean;
  error?: string;
}

function App() {
  const [currentState, setCurrentState] = useState<AppState>('landing');
  const [driveLink, setDriveLink] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [processedDeckData, setProcessedDeckData] = useState<any>(null);
  const [showApiResponse, setShowApiResponse] = useState(false);
  const [pitch_deck_text, setPitchDeckText] = useState<string>('');
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [founder_name, setFounderName] = useState<string>('');
  const [showDisplayStep, setShowDisplayStep] = useState(false);
  const [retellSessionData, setRetellSessionData] = useState<RetellSessionResponse | null>(null);
  const [isOnCall, setIsOnCall] = useState(false);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [callTime, setCallTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);

  // Refs for cleanup and tracking
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retellClientRef = useRef<RetellWebClient | null>(null);
  const callIdRef = useRef<string | null>(null);
  const apiCallMadeRef = useRef<boolean>(false);

  // Agent ID for Retell
  const agentId = "agent_b795ddf35c70722141b715a820";
  const userEmail = "user@example.com"; // You can make this dynamic

  const validateGoogleDriveLink = (url: string): boolean => {
    const drivePatterns = [
      /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/,
      /^https:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9-_]+)/,
      /^https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9-_]+)/
    ];
    
    return drivePatterns.some(pattern => pattern.test(url));
  };

  const handleSubmitLink = async () => {
    if (!founder_name.trim()) {
      setError('Please enter your name');
      return;
    }

    // If no drive link provided, skip processing and go directly to ready state
    if (!driveLink.trim()) {
      setError(null);
      setPitchDeckText('No pitch deck provided - the AI investor will ask general startup questions.');
      setCurrentState('ready');
      return;
    }

    if (!validateGoogleDriveLink(driveLink)) {
      setError('Please enter a valid Google Drive link (drive.google.com or docs.google.com)');
      return;
    }

    setError(null);
    setCurrentState('processing');
    setProcessingProgress(0);
    
    try {
      // Start progress simulation
      const progressInterval = startProgressSimulation();
      
      // Make API call to Airops with retry logic
      console.log('📡 Processing deck with enhanced retry logic...');
      const result = await processAiropsDeck({ deck_url: driveLink });

      // Clear progress simulation
      clearInterval(progressInterval);

      // Check if the response indicates success
      if (!result.success || result.error) {
        throw new Error(result.error || 'Failed to process deck');
      }

      // Store the processed deck data
      setProcessedDeckData(result);
      
      // Extract and assign pitch text to pitch_deck_text variable
      const extractedPitchText = result?.outputs?.pitch_text || 
                               result?.data?.pitch_text || 
                               JSON.stringify(result);
      
      setPitchDeckText(extractedPitchText);
      
      // Complete progress and move to ready state
      setProcessingProgress(100);
      setTimeout(() => setCurrentState('ready'), 500);
      
    } catch (err) {
      console.error('Error processing deck:', err);
      setError(
        err instanceof Error 
          ? `Processing failed: ${err.message}` 
          : 'Failed to process your deck. Please check your link and try again.'
      );
      setCurrentState('landing');
      setProcessingProgress(0);
    }
  };

  const startProgressSimulation = () => {
    let progress = 0;
    return setInterval(() => {
      progress += Math.random() * 8 + 2;
      if (progress >= 90) {
        progress = 90;
      }
      setProcessingProgress(progress);
    }, 800);
  };

  // Enhanced call flow implementation with server-side API calls
  const startPracticeCall = async () => {
    console.log('🚀 Step 1: User clicked "Start Call"');
    
    try {
      // 1. Show loading spinner
      setIsStartingCall(true);
      setError(null);
      
      console.log('🔧 Step 2: Checking browser audio support...');
      
      // 2. Check browser audio support
      if (!window.navigator.mediaDevices) {
        throw new Error('Browser audio unsupported');
      }
      
      console.log('🎤 Step 3: Requesting microphone permission...');
      
      // 3. Request microphone permission
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Step 3 Complete: Microphone permission granted');
      } catch (micError) {
        throw new Error('Please enable your microphone to continue');
      }

      console.log('📡 Step 4: Creating Retell session via server-side API...');
      
      // 4. Create Retell session via server-side API simulation
      const sessionRequest: RetellSessionRequest = {
        agent_id: agentId,
        founder_name: founder_name,
        pitch_deck_text: pitch_deck_text
      };

      const sessionResponse = await apiCallWithRetry(
        () => createRetellSession(sessionRequest),
        { maxAttempts: 3, baseDelay: 1000 }
      );
      
      // 5. Check response
      if (!sessionResponse.success || !sessionResponse.access_token) {
        throw new Error(sessionResponse.error || 'Failed to create voice session');
      }

      console.log('✅ Step 4 Complete: Session created:', sessionResponse);
      
      // Store call ID for later use
      callIdRef.current = sessionResponse.call_id;
      setRetellSessionData(sessionResponse);

      console.log('🎯 Step 5: Initializing voice client...');
      
      // 6. Initialize RetellWebClient
      const client = new RetellWebClient({
        accessToken: sessionResponse.access_token,
        callId: sessionResponse.call_id
      });

      retellClientRef.current = client;
      console.log('✅ RetellWebClient initialized');

      console.log('👂 Step 6: Setting up call event listeners...');

      // 7. Listen for call events
      client.on('call_started', (event: any) => {
        console.log('📞 Call started event received', event);
        setIsOnCall(true);
        setCallTime(0);
        setStartTime(Date.now());
        setEndTime(null);
        apiCallMadeRef.current = false;
        setIsStartingCall(false);
        setCurrentState('calling');
        
        if (event?.call_id) {
          callIdRef.current = event.call_id;
        }
        
        // Start timer
        callTimerRef.current = setInterval(() => {
          setCallTime(prev => prev + 1);
        }, 1000);
      });
      
      client.on('call_ended', async () => {
        console.log('📞 Call ended event received');
        await handleCallEnded();
      });
      
      client.on('call_error', (error: any) => {
        console.error('📞 Call error:', error);
        setError('Call error occurred. Please try again.');
        setIsStartingCall(false);
        setCurrentState('ready');
      });

      console.log('✅ Step 6 Complete: Event listeners set up');

      console.log('🎯 Step 7: Starting the actual call...');
      
      // 8. Start the call
      client.startCall().then(() => {
        console.log('✅ Step 7 Complete: Call start initiated');
      }).catch((startError) => {
        console.error('❌ Error starting call:', startError);
        setError('Failed to start call. Please try again.');
        setIsStartingCall(false);
      });
      
    } catch (err) {
      console.error('❌ Error in call flow:', err);
      setError(
        err instanceof Error 
          ? err.message
          : 'Failed to start practice session. Please try again.'
      );
      setIsStartingCall(false);
    }
  };

  const handleCallEnded = async () => {
    console.log('🛑 Handling call end...');
    
    setIsOnCall(false);
    const call_id = callIdRef.current;
    
    if (!call_id || apiCallMadeRef.current) {
      console.log('No call ID or API call already made, skipping transcript fetch');
      setCurrentState('summary');
      return;
    }

    // Set end time and calculate final duration
    const currentEndTime = Date.now();
    setEndTime(currentEndTime);
    
    const execTime = startTime ? (currentEndTime - startTime) / 1000 : callTime;
    const finalDurationSeconds = Math.floor(execTime);
    setCallDuration(finalDurationSeconds);
    
    const readableTime = formatTime(finalDurationSeconds);
    console.log("Call duration:", readableTime);

    // Mark that we're making the API call
    apiCallMadeRef.current = true;
    
    try {
      // Call server-side API to get transcript
      const transcriptRequest: TranscriptRequest = {
        call_id: call_id,
        agent_id: agentId,
        caller_email: userEmail,
        call_duration: readableTime
      };

      const transcriptResponse = await apiCallWithRetry(
        () => getCallTranscript(transcriptRequest),
        { maxAttempts: 2, baseDelay: 1000 }
      );

      console.log('Transcript response received:', transcriptResponse);

      // Generate session data
      setSessionData({
        transcript: transcriptResponse.transcript,
        duration: finalDurationSeconds,
        questionsAsked: 8,
        topicsCovered: ['Customer Acquisition', 'Unit Economics', 'Market Size', 'Competition', 'Team Scaling', 'Revenue Model']
      });

    } catch (error) {
      console.error('Error fetching transcript:', error);
      // Still show summary even if transcript fetch fails
      setSessionData({
        transcript: `Session completed with ${founder_name}. Call ID: ${call_id}`,
        duration: finalDurationSeconds,
        questionsAsked: 8,
        topicsCovered: ['Customer Acquisition', 'Unit Economics', 'Market Size', 'Competition', 'Team Scaling', 'Revenue Model']
      });
    }

    // Clear timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    
    setCurrentState('summary');
  };

  const toggleMute = () => {
    if (retellClientRef.current) {
      retellClientRef.current.toggleMute();
      setIsMuted(retellClientRef.current.isMuted());
    }
  };

  const endCall = async () => {
    console.log('🛑 User manually ending call...');
    
    // Stop the call if client exists
    if (retellClientRef.current) {
      try {
        await retellClientRef.current.stopCall();
      } catch (error) {
        console.error('Error stopping call:', error);
      }
    }
    
    // The call_ended event will handle the rest
  };

  const resetApp = () => {
    // Clean up any active call
    if (retellClientRef.current) {
      try {
        retellClientRef.current.stopCall();
      } catch (error) {
        console.error('Error stopping call during reset:', error);
      }
    }
    
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    
    // Reset all state
    setCurrentState('landing');
    setDriveLink('');
    setProcessingProgress(0);
    setError(null);
    setCallDuration(0);
    setCallTime(0);
    setStartTime(null);
    setEndTime(null);
    setSessionData(null);
    setProcessedDeckData(null);
    setIsMuted(false);
    setShowApiResponse(false);
    setPitchDeckText('');
    setIsTextExpanded(false);
    setFounderName('');
    setShowDisplayStep(false);
    setRetellSessionData(null);
    setIsOnCall(false);
    setCallStartTime(null);
    setIsStartingCall(false);
    
    retellClientRef.current = null;
    callIdRef.current = null;
    apiCallMadeRef.current = false;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      if (retellClientRef.current) {
        try {
          retellClientRef.current.stopCall();
        } catch (error) {
          console.error('Error stopping call on unmount:', error);
        }
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Landing Page */}
      {currentState === 'landing' && (
        <div className="container mx-auto px-6 py-12">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-6">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Practice Your Pitch
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                Get ready for investor meetings with our AI-powered pitch practice tool. 
                Share your deck and practice with a realistic investor voice agent.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <Link className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Share Your Deck</h3>
                <p className="text-gray-600">Optionally paste a Google Drive link to your pitch deck</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <FileText className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Analysis</h3>
                <p className="text-gray-600">Our AI processes your deck or asks general startup questions</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <Mic className="w-12 h-12 text-purple-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Practice Session</h3>
                <p className="text-gray-600">Have a realistic conversation with an AI investor</p>
              </div>
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Get Started</h2>
                
                {/* Founder Name Input */}
                <div className="mb-6">
                  <label htmlFor="founder-name" className="block text-sm font-medium text-gray-700 mb-2">
                    Your Name (Founder) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="founder-name"
                      value={founder_name}
                      onChange={(e) => setFounderName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                      required
                    />
                    <User className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">This will be used to personalize your practice session</p>
                </div>

                <div className="mb-6">
                  <label htmlFor="drive-link" className="block text-sm font-medium text-gray-700 mb-2">
                    Google Drive Link to Your Pitch Deck <span className="text-gray-400">(Optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      id="drive-link"
                      value={driveLink}
                      onChange={(e) => setDriveLink(e.target.value)}
                      placeholder="https://drive.google.com/file/d/... (optional)"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                    />
                    <Link className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to practice with general startup questions, or provide a deck for tailored questions
                  </p>
                </div>

                {/* Display Step Toggle */}
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Settings className="w-5 h-5 text-gray-600" />
                      <div>
                        <h4 className="font-medium text-gray-900">Developer Mode</h4>
                        <p className="text-sm text-gray-600">Show technical details and API responses</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDisplayStep(!showDisplayStep)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                        showDisplayStep ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                          showDisplayStep ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {showDisplayStep ? 'Technical details will be shown after processing' : 'Clean user experience without technical details'}
                  </div>
                </div>

                {driveLink.trim() && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-amber-800 mb-1">Important: Sharing Permissions</h4>
                        <p className="text-sm text-amber-700">
                          Make sure your Google Drive file is set to <strong>"Anyone with the link can view"</strong> 
                          so our system can access and process your deck.
                        </p>
                        <a 
                          href="https://support.google.com/drive/answer/2494822" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-800 mt-2 underline"
                        >
                          Learn how to share files
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSubmitLink}
                  disabled={!founder_name.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-8 rounded-lg transition-colors duration-200"
                >
                  {driveLink.trim() ? 'Process My Deck' : 'Start Practice Session'}
                </button>

                {error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-red-700 text-sm font-medium mb-1">Error Details:</p>
                        <pre className="text-red-700 text-xs whitespace-pre-wrap font-mono bg-red-100 p-2 rounded border max-h-32 overflow-y-auto">
                          {error}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 text-xs text-gray-500 space-y-1">
                  <p>• Enhanced reliability with bundled Retell SDK</p>
                  <p>• Server-side API key management for security</p>
                  <p>• No account required, no data stored</p>
                  <p>• Processing typically takes 30-60 seconds (when deck provided)</p>
                  <p>• Can practice without a deck using general startup questions</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Processing State */}
      {currentState === 'processing' && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="max-w-md mx-auto text-center p-8">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-6 animate-pulse">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Processing Your Deck</h2>
              <p className="text-gray-600 mb-6">
                Our AI is fetching and analyzing your pitch deck to understand your business model, 
                market opportunity, and key metrics.
              </p>
              {founder_name && (
                <p className="text-blue-600 font-medium mb-4">
                  Preparing personalized session for {founder_name}
                </p>
              )}
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${processingProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500">{Math.round(processingProgress)}% complete</p>
            
            <div className="mt-6 text-xs text-gray-500">
              <p>Enhanced with retry logic for better reliability</p>
            </div>
          </div>
        </div>
      )}

      {/* Ready State */}
      {currentState === 'ready' && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="max-w-4xl mx-auto text-center p-8">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-6">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Ready to Practice{founder_name ? `, ${founder_name}` : ''}!
              </h2>
              <p className="text-gray-600 mb-6">
                {pitch_deck_text.includes('No pitch deck provided') 
                  ? 'The AI investor is ready to ask you general startup questions about your business idea, market opportunity, and growth strategy.'
                  : 'Your pitch deck has been processed successfully. The AI investor is ready to ask you challenging questions about your business.'
                }
              </p>
              
              <div className="bg-blue-50 p-4 rounded-lg mb-6 text-left">
                <h3 className="font-semibold text-blue-900 mb-2">What to Expect:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  {pitch_deck_text.includes('No pitch deck provided') ? (
                    <>
                      <li>• General startup and business model questions</li>
                      <li>• Questions about market opportunity and competition</li>
                      <li>• Discussion about team, funding, and growth plans</li>
                      <li>• Practice explaining your startup concept clearly</li>
                    </>
                  ) : (
                    <>
                      <li>• Questions tailored to your specific business</li>
                      <li>• Follow-up questions on key metrics and assumptions</li>
                      <li>• Realistic investor conversation flow</li>
                      <li>• Practice handling objections and concerns</li>
                    </>
                  )}
                </ul>
              </div>

              {/* Conditional Display Step - Only show if toggle is enabled */}
              {showDisplayStep && (
                <div className="space-y-6 mb-8">
                  {/* Display Founder Name Variable */}
                  {founder_name && (
                    <div className="bg-green-50 border-l-4 border-green-400 p-4 text-left">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-green-600" />
                        <h4 className="font-semibold text-green-800">Founder Name Variable</h4>
                      </div>
                      <div className="bg-white border rounded p-3">
                        <p className="text-sm text-gray-700">
                          Variable: <code className="bg-green-100 px-1 rounded">founder_name</code>
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          Value: <span className="font-medium">{founder_name}</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Enhanced Pitch Deck Text Display */}
                  {pitch_deck_text && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 text-left">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                          <h4 className="font-semibold text-yellow-800">Pitch Deck Text Variable Content</h4>
                        </div>
                        <button
                          onClick={() => setIsTextExpanded(!isTextExpanded)}
                          className="flex items-center gap-1 text-sm text-yellow-600 hover:text-yellow-700 transition-colors"
                        >
                          {isTextExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                          {isTextExpanded ? 'Collapse' : 'Expand Full Text'}
                        </button>
                      </div>
                      
                      <div className="bg-white border rounded-lg p-4 relative">
                        <div 
                          className={`text-sm text-gray-700 whitespace-pre-wrap transition-all duration-300 ${
                            isTextExpanded ? 'max-h-none' : 'max-h-32 overflow-hidden'
                          }`}
                        >
                          {pitch_deck_text}
                        </div>
                        
                        {!isTextExpanded && pitch_deck_text.length > 200 && (
                          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent"></div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-yellow-700">
                          Variable: <code className="bg-yellow-100 px-1 rounded">pitch_deck_text</code>
                        </p>
                        <p className="text-xs text-yellow-700">
                          Length: {pitch_deck_text.length.toLocaleString()} characters
                        </p>
                      </div>
                      
                      {!isTextExpanded && pitch_deck_text.length > 200 && (
                        <button
                          onClick={() => setIsTextExpanded(true)}
                          className="mt-2 text-sm text-yellow-600 hover:text-yellow-700 underline"
                        >
                          Click "Expand Full Text" above to see complete content
                        </button>
                      )}
                    </div>
                  )}

                  {/* Airops Response Display */}
                  {processedDeckData && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <Code className="w-4 h-4" />
                          Full API Response
                        </h3>
                        <button
                          onClick={() => setShowApiResponse(!showApiResponse)}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                        >
                          <Eye className="w-4 h-4" />
                          {showApiResponse ? 'Hide' : 'Show'} Raw Data
                        </button>
                      </div>
                      
                      <div className="text-sm text-green-700 mb-2">
                        ✅ Deck processed successfully with enhanced retry logic
                      </div>
                      
                      {showApiResponse && (
                        <div className="bg-white border rounded p-3 max-h-64 overflow-y-auto">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                            {JSON.stringify(processedDeckData, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Toggle Status Indicator */}
              {!showDisplayStep && (processedDeckData || pitch_deck_text) && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <EyeOff className="w-4 h-4" />
                    <span className="text-sm">Technical details hidden - Enable Developer Mode to view</span>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={startPracticeCall}
              disabled={isStartingCall}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-8 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 mx-auto"
            >
              {isStartingCall ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Starting Call...
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  Start Practice Session
                </>
              )}
            </button>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-700 text-sm font-medium mb-1">Error Details:</p>
                    <pre className="text-red-700 text-xs whitespace-pre-wrap font-mono bg-red-100 p-2 rounded border max-h-32 overflow-y-auto">
                      {error}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calling State */}
      {currentState === 'calling' && (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center">
          <div className="max-w-md mx-auto text-center p-8">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-6 animate-pulse">
                <Mic className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Practice Session Active</h2>
              <p className="text-blue-100 mb-6">
                You're now in a practice session{founder_name ? `, ${founder_name}` : ''}. Present your pitch and 
                answer questions naturally.
              </p>
              
              {retellSessionData && showDisplayStep && (
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6 text-left">
                  <h4 className="text-white font-medium mb-2">Session Info:</h4>
                  <p className="text-blue-100 text-sm">Call ID: {retellSessionData.call_id}</p>
                  <p className="text-blue-100 text-sm">Agent ID: {retellSessionData.agent_id}</p>
                  <p className="text-blue-100 text-sm">Status: {isOnCall ? 'Connected' : 'Connecting...'}</p>
                  <p className="text-blue-100 text-sm">Enhanced: Bundled SDK + Retry Logic</p>
                </div>
              )}
              
              <div className="text-3xl font-mono text-white mb-8">
                {formatTime(callTime)}
              </div>
            </div>
            
            <div className="flex justify-center gap-4">
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition-colors duration-200 ${
                  isMuted 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
              </button>
              
              <button
                onClick={endCall}
                className="p-4 bg-red-500 hover:bg-red-600 rounded-full transition-colors duration-200"
              >
                <PhoneOff className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary State */}
      {currentState === 'summary' && sessionData && (
        <div className="container mx-auto px-6 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Session Complete{founder_name ? `, ${founder_name}` : ''}
              </h1>
              <p className="text-gray-600">Here's a summary of your practice session</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                <Clock className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                <div className="text-2xl font-bold text-gray-900">{formatTime(sessionData.duration)}</div>
                <div className="text-sm text-gray-600">Session Duration</div>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                <MessageSquare className="w-8 h-8 text-green-600 mx-auto mb-3" />
                <div className="text-2xl font-bold text-gray-900">{sessionData.questionsAsked}</div>
                <div className="text-sm text-gray-600">Questions Asked</div>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-3" />
                <div className="text-2xl font-bold text-gray-900">{sessionData.topicsCovered.length}</div>
                <div className="text-sm text-gray-600">Topics Covered</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Topics Discussed</h3>
                <div className="space-y-2">
                  {sessionData.topicsCovered.map((topic, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700">{topic}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversation Transcript</h3>
                <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">{sessionData.transcript}</pre>
                </div>
              </div>
            </div>

            {/* Show Retell Session Data in Summary if Developer Mode is enabled */}
            {showDisplayStep && retellSessionData && (
              <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                  <Mic className="w-5 h-5" />
                  Session Technical Details (Enhanced)
                </h3>
                <div className="bg-white border rounded p-4">
                  <div className="text-sm text-green-700 mb-2">
                    ✅ Session created with enhanced reliability features:
                  </div>
                  <ul className="text-xs text-gray-600 mb-3 space-y-1">
                    <li>• Bundled Retell SDK for maximum reliability</li>
                    <li>• API retry logic with exponential backoff</li>
                    <li>• Server-side API key management</li>
                    <li>• Enhanced error handling</li>
                  </ul>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(retellSessionData, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="text-center mt-8">
              <button
                onClick={resetApp}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
              >
                Start New Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;