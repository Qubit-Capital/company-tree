# AI Investor Pitch Practice App - Architecture Documentation

## Overview

The AI Investor Pitch Practice App is a React-based web application that allows entrepreneurs to practice their investor pitches with an AI-powered voice agent. The app processes pitch decks, creates personalized practice sessions, and provides real-time voice interaction using Retell AI's voice technology.

## Directory Structure

```
ai-investor-pitch-practice/
├── public/
│   └── vite.svg                    # Default Vite favicon
├── src/
│   ├── api/
│   │   ├── airopsSession.ts        # Server-side simulation for Airops deck processing
│   │   └── retellSession.ts        # Server-side simulation for Retell session management
│   ├── utils/
│   │   └── apiRetry.ts             # API retry utility with exponential backoff
│   ├── App.tsx                     # Main application component
│   ├── main.tsx                    # React app entry point
│   ├── index.css                   # Global styles with Tailwind imports
│   └── vite-env.d.ts              # Vite TypeScript definitions
├── dist/                           # Build output directory (generated)
│   ├── assets/
│   │   ├── index-*.css             # Compiled CSS bundle
│   │   └── index-*.js              # Compiled JavaScript bundle
│   └── index.html                  # Production HTML file
├── node_modules/                   # Dependencies (not tracked)
├── .bolt/                          # Bolt-specific configuration
│   ├── config.json
│   └── prompt
├── .gitignore                      # Git ignore rules
├── package.json                    # Project dependencies and scripts
├── postcss.config.js              # PostCSS configuration for Tailwind
├── tailwind.config.js             # Tailwind CSS configuration
├── tsconfig.json                   # TypeScript configuration root
├── tsconfig.app.json              # TypeScript config for app source
├── tsconfig.node.json             # TypeScript config for Node.js files
├── vite.config.ts                 # Vite build tool configuration
├── eslint.config.js               # ESLint configuration
├── index.html                     # Main HTML template
└── app_architecture.md            # This documentation file
```

## Technology Stack

### Frontend Framework
- **React 18.3.1** - Modern React with hooks and functional components
- **TypeScript** - Type-safe JavaScript development
- **Vite** - Fast build tool and development server

### Styling & UI
- **Tailwind CSS 3.4.1** - Utility-first CSS framework
- **Lucide React 0.344.0** - Beautiful, customizable SVG icons
- **Custom CSS** - Minimal custom styles for specific needs

### Voice Integration
- **@retell-ai/web-sdk 2.0.0** - Bundled Retell AI Web Client for voice conversations
- **Web Audio API** - Browser-native audio handling
- **MediaDevices API** - Microphone access and permissions

### External APIs
- **Airops API** - Pitch deck processing and analysis
- **Retell AI API** - Voice agent session management
- **Google Drive API** - Indirect access via Airops for deck processing

### Development Tools
- **ESLint** - Code linting and quality enforcement
- **TypeScript ESLint** - TypeScript-specific linting rules
- **Autoprefixer** - CSS vendor prefix automation
- **PostCSS** - CSS processing pipeline

## Application Architecture

### Component Structure

The application follows a single-component architecture with state management handled entirely within the main `App.tsx` component:

```
App Component
├── State Management (React useState)
├── Effect Hooks (React useEffect)
├── Refs (React useRef)
├── Helper Functions
├── Event Handlers
└── Conditional Rendering (5 main states)
```

### Application States

The app operates through five distinct states managed by the `currentState` variable:

1. **Landing State** (`'landing'`)
   - User input collection (name, optional deck link)
   - Validation and form submission
   - Developer mode toggle

2. **Processing State** (`'processing'`)
   - Deck analysis via Airops API
   - Progress indication with simulated loading
   - Error handling for API failures

3. **Ready State** (`'ready'`)
   - Display processed deck information
   - Developer mode technical details
   - Call initiation interface

4. **Calling State** (`'calling'`)
   - Active voice session with AI investor
   - Real-time call controls (mute/unmute, end call)
   - Call duration tracking

5. **Summary State** (`'summary'`)
   - Session results and analytics
   - Conversation transcript display
   - Option to start new session

### Data Flow

```
User Input → Deck Processing → AI Session Setup → Voice Interaction → Results Summary
     ↓              ↓                ↓               ↓                ↓
  Landing      Processing        Ready          Calling          Summary
```

## Key Features & Implementation

### 1. Pitch Deck Processing
- **Optional deck upload** via Google Drive links
- **Airops API integration** for content extraction and analysis
- **Fallback mode** for users without decks (general startup questions)
- **Validation** for Google Drive URL formats

### 2. Voice AI Integration
- **Bundled Retell Web Client** for maximum reliability (no CDN dependencies)
- **Direct import** from `@retell-ai/web-sdk` package
- **Event-driven architecture** for call state management
- **Optimized with Vite** for fast loading and performance

### 3. Session Management
- **Call state tracking** with timers and duration calculation
- **Microphone permission handling** with user-friendly error messages
- **Session data persistence** throughout the call lifecycle
- **Cleanup mechanisms** for proper resource management

### 4. Developer Experience
- **Developer mode toggle** for technical details visibility
- **Comprehensive error handling** with detailed error messages
- **Console logging** for debugging and monitoring
- **API response inspection** tools

## API Integration

### Airops API
- **Endpoint**: `https://app.airops.com/public_api/airops_apps/9f3205b9-8b86-4cb5-8026-41ff5aaf0020/execute`
- **Purpose**: Pitch deck content extraction and analysis
- **Authentication**: Bearer token (server-side simulation)
- **Input**: Google Drive URL
- **Output**: Processed pitch deck text

### Retell AI API
- **Endpoint**: `https://api.retellai.com/v2/create-web-call`
- **Purpose**: Voice session creation and management
- **Authentication**: API key (server-side simulation)
- **Agent ID**: `agent_b795ddf35c70722141b715a820`
- **Features**: Real-time voice conversation, call events, session management

## State Management

### Primary State Variables
```typescript
currentState: AppState           // Main application flow control
driveLink: string               // User-provided Google Drive URL
founder_name: string            // User's name for personalization
pitch_deck_text: string        // Processed deck content
processedDeckData: any          // Raw API response from Airops
retellSessionData: RetellSessionResponse | null  // Retell session info
sessionData: SessionData | null // Final session results
```

### UI State Variables
```typescript
processingProgress: number      // Loading progress indicator
error: string | null           // Error message display
isMuted: boolean              // Microphone mute state
isOnCall: boolean             // Active call indicator
callTime: number              // Current call duration
isStartingCall: boolean       // Call initiation loading state
showDisplayStep: boolean      // Developer mode toggle
```

### Refs for Resource Management
```typescript
callTimerRef: useRef<NodeJS.Timeout | null>     // Call duration timer
retellClientRef: useRef<RetellWebClient | null>  // Retell client instance
callIdRef: useRef<string | null>                // Current call identifier
apiCallMadeRef: useRef<boolean>                 // Prevent duplicate API calls
```

## Error Handling Strategy

### Network & API Errors
- **Safe API calls** with comprehensive error parsing
- **Retry logic** with exponential backoff for improved reliability
- **Timeout handling** for long-running operations
- **User-friendly error messages** with technical details in developer mode

### Voice Session Errors
- **Microphone permission handling** with clear user guidance
- **Retell client initialization** with bundled package reliability
- **Call state error recovery** with graceful fallbacks
- **Resource cleanup** on errors to prevent memory leaks

### User Input Validation
- **Required field validation** (founder name)
- **URL format validation** for Google Drive links
- **Real-time feedback** for invalid inputs

## Security Considerations

### API Key Management
- **Server-side simulation** for API key handling (demo purposes)
- **CORS handling** for cross-origin requests
- **No sensitive data storage** in browser

### User Privacy
- **No persistent data storage** - sessions are ephemeral
- **Microphone permission** explicit user consent required
- **No user account system** - anonymous usage

## Performance Optimizations

### Bundle Optimization
- **Vite build system** for fast development and optimized production builds
- **Tree shaking** to eliminate unused code
- **CSS purging** via Tailwind for minimal stylesheet size
- **Bundled dependencies** for maximum reliability

### Runtime Performance
- **Single component architecture** reduces complexity
- **Efficient state updates** with proper React patterns
- **Resource cleanup** prevents memory leaks
- **Bundled Retell Web Client** eliminates CDN loading delays

## Deployment Architecture

### Build Process
1. **TypeScript compilation** with strict type checking
2. **Tailwind CSS processing** with PostCSS
3. **Asset optimization** and bundling via Vite
4. **Static file generation** for CDN deployment

### Hosting
- **Static hosting compatible** (Netlify, Vercel, etc.)
- **CDN distribution** for global performance
- **HTTPS by default** for secure voice API access

## File Organization

### `/src/api/` - API Layer
- **airopsSession.ts**: Server-side simulation for Airops deck processing
- **retellSession.ts**: Server-side simulation for Retell session management

### `/src/utils/` - Utility Functions
- **apiRetry.ts**: API retry logic with exponential backoff

### `/src/` - Core Application
- **App.tsx**: Main application component with all state management
- **main.tsx**: React application entry point
- **index.css**: Global styles with Tailwind imports

### Configuration Files
- **vite.config.ts**: Vite configuration with Retell SDK optimization
- **tailwind.config.js**: Tailwind CSS configuration
- **tsconfig.*.json**: TypeScript configuration files
- **eslint.config.js**: ESLint configuration

## Future Enhancements

### Potential Improvements
1. **Backend API** for secure API key management
2. **User accounts** for session history and analytics
3. **Advanced analytics** with detailed feedback and scoring
4. **Multiple AI investor personas** for varied practice experiences
5. **Session recording** and playback capabilities
6. **Integration with popular pitch deck platforms** (Figma, Canva, etc.)

### Scalability Considerations
1. **Component modularization** as features grow
2. **State management library** (Redux/Zustand) for complex state
3. **API abstraction layer** for multiple service integrations
4. **Caching strategies** for improved performance
5. **Error tracking** and monitoring systems

## Development Guidelines

### Code Organization
- **Single responsibility principle** for functions
- **TypeScript strict mode** for type safety
- **Consistent naming conventions** throughout codebase
- **Comprehensive error handling** at all integration points

### Testing Strategy
- **Manual testing** for voice interactions
- **API integration testing** with mock responses
- **Cross-browser compatibility** testing
- **Mobile responsiveness** verification

### Maintenance
- **Regular dependency updates** for security and performance
- **API version monitoring** for breaking changes
- **Performance monitoring** for user experience optimization
- **Error logging** for production issue identification

---

*This architecture document serves as a comprehensive guide for understanding, maintaining, and extending the AI Investor Pitch Practice App.*