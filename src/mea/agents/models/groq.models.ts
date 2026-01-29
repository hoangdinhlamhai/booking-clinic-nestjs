import Groq from 'groq-sdk';

/**
 * Lazy-initialized Groq client
 * This ensures environment variables are loaded before creating the client
 */
let groqInstance: Groq | null = null;

/**
 * Get or create Groq client instance
 * @returns Groq client instance
 */
export function getGroqClient(): Groq {
    if (!groqInstance) {
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            throw new Error(
                'GROQ_API_KEY is not set. Please add it to your .env file'
            );
        }

        groqInstance = new Groq({ apiKey });
    }

    return groqInstance;
}

// Groq model identifiers
export const GROQ_MODEL_STANDARD = 'openai/gpt-oss-120b';  // Fast, good for structured tasks
export const GROQ_MODEL_EXPERT = 'openai/gpt-oss-20b';     // Smaller, good for generation
