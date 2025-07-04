// API retry utility with exponential backoff
export interface RetryConfig {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

export async function apiCallWithRetry<T>(
  apiCall: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2
  } = config;

  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 API attempt ${attempt}/${maxAttempts}`);
      const result = await apiCall();
      if (attempt > 1) {
        console.log(`✅ API call succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`❌ API attempt ${attempt} failed:`, lastError.message);
      
      if (attempt === maxAttempts) {
        console.error(`💥 All ${maxAttempts} API attempts failed`);
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );
      
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Specific retry wrapper for Airops API
export async function airopsApiCall(url: string, options: RequestInit) {
  return apiCallWithRetry(
    () => fetch(url, options).then(async response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      return response.json();
    }),
    {
      maxAttempts: 3,
      baseDelay: 2000, // 2 second initial delay
      maxDelay: 8000   // Max 8 second delay
    }
  );
}