/**
 * Ollama Client for Local LLM
 * 
 * Provides interface to call local LLM models via Ollama API
 * Default URL: http://localhost:11434/api/generate
 */

export interface OllamaGenerateRequest {
    model: string;
    prompt: string;
    stream?: boolean;
    format?: 'json';
    options?: {
        temperature?: number;
        top_p?: number;
        num_ctx?: number;
    };
}

export interface OllamaGenerateResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    context?: number[];
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    eval_count?: number;
    eval_duration?: number;
}

// Ollama configuration
export const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3:8b';

/**
 * Generate completion using Ollama API
 * @param prompt The prompt to send
 * @param options Additional options
 * @returns Generated text response
 */
export async function ollamaGenerate(
    prompt: string,
    options: {
        model?: string;
        temperature?: number;
        jsonFormat?: boolean;
    } = {},
): Promise<string> {
    const { model = OLLAMA_MODEL, temperature = 0.1, jsonFormat = false } = options;

    const requestBody: OllamaGenerateRequest = {
        model,
        prompt,
        stream: false,
        options: {
            temperature,
            num_ctx: 4096, // Context window size
        },
    };

    if (jsonFormat) {
        requestBody.format = 'json';
    }

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data: OllamaGenerateResponse = await response.json();
    return data.response;
}

/**
 * Chat completion using Ollama API (alternative format)
 */
export interface OllamaChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export async function ollamaChat(
    messages: OllamaChatMessage[],
    options: {
        model?: string;
        temperature?: number;
        jsonFormat?: boolean;
    } = {},
): Promise<string> {
    const { model = OLLAMA_MODEL, temperature = 0.1, jsonFormat = false } = options;

    const requestBody = {
        model,
        messages,
        stream: false,
        format: jsonFormat ? 'json' : undefined,
        options: {
            temperature,
            num_ctx: 4096,
        },
    };

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        throw new Error(`Ollama Chat API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.message?.content || '';
}
