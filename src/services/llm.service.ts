import logger from '../utils/logger';

// Mock config: you can change these to simulate different failure scenarios
export const MockLLMConfig = {
  failureRate: 0.5, // 50% chance to fail
  minDelayMs: 5000,   // 5 seconds minimum delay
  maxDelayMs: 60000,  // 60 seconds maximum delay
  permanentFailureRate: 0.8 // 10% chance to throw a permanent schema error
};

export class TransientLLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientLLMError';
  }
}

export class PermanentLLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentLLMError';
  }
}

export const LLMService = {
  /**
   * Mock implementation of an LLM translation service.
   * Simulates a delay and simply prefixes translated strings with the language code.
   * Also simulates occasional transient and permanent failures based on MockLLMConfig.
   */
  async mockTranslate(content: Record<string, any>, targetLang: string, selectedKeys?: string[]): Promise<Record<string, any>> {
    logger.info(`Starting mock translation for language: ${targetLang}`);
    
    // Simulate LLM latency (Random between 5 and 60 seconds)
    const delay = Math.floor(Math.random() * (MockLLMConfig.maxDelayMs - MockLLMConfig.minDelayMs + 1)) + MockLLMConfig.minDelayMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
    
    const random = Math.random();

    // Simulate Permanent Failure (e.g., Unparseable JSON, Schema mismatch)
    if (random < MockLLMConfig.permanentFailureRate) {
      logger.error(`[MOCK LLM] Simulating Permanent Failure for ${targetLang}`);
      throw new PermanentLLMError(`LLM returned invalid JSON schema for language: ${targetLang}`);
    }
    
    // Simulate Transient Failure (e.g., 429 Rate Limit, 503 Gateway Timeout)
    if (random < MockLLMConfig.failureRate) {
      logger.error(`[MOCK LLM] Simulating Transient Failure for ${targetLang}`);
      throw new TransientLLMError(`Rate limit exceeded for LLM provider.`);
    }

    // Deep clone the content
    const translatedContent = JSON.parse(JSON.stringify(content));
    
    // Recursive function to mock translate strings
    const translateStrings = (obj: any, currentPath: string = '') => {
      for (const key in obj) {
        const path = currentPath ? `${currentPath}.${key}` : key;
        
        // If selectedKeys are provided, only translate matching paths
        if (selectedKeys && selectedKeys.length > 0) {
          const genericPath = path.replace(/\.\d+/g, '');
          const shouldTranslate = selectedKeys.some(sk => genericPath.startsWith(sk) || sk.startsWith(genericPath));
          if (!shouldTranslate) continue;
        }

        if (typeof obj[key] === 'string') {
          obj[key] = `[${targetLang.toUpperCase()}] ${obj[key]}`;
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          translateStrings(obj[key], path);
        }
      }
    };
    
    translateStrings(translatedContent);
    logger.info(`Completed mock translation for language: ${targetLang}`);
    return translatedContent;
  }
};
