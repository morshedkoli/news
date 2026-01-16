export type AiProviderType = 'local' | 'openai-compatible';

export interface AiProvider {
    id: string;
    name: string;
    // 'local' and 'openai-compatible' are kept for backward compatibility but mapped to generic logic
    type: 'local' | 'openai-compatible' | 'custom';
    provider_category: 'free' | 'paid' | 'local';
    endpoint: string;
    apiKey?: string;
    model: string;
    priority: number;
    enabled: boolean;
    lastStatus: 'online' | 'offline' | 'unknown';
    lastChecked?: string;
    description?: string;

    // Generic Configuration
    // Template Configuration
    method: 'POST' | 'GET'; // Default POST
    headers?: Record<string, string>; // Headers template
    body_template?: any; // JSON body with {{PROMPT}} macros
    response_path?: string; // e.g. "choices[0].message.content"
    success_condition?: string; // e.g. "response.choices.length > 0"
    timeout_ms?: number;
}

export interface AiResponse {
    content: string;
    providerUsed: string;
    modelUsed: string;
    executionTimeMs: number;
}

export interface AiGenerationOptions {
    systemPrompt?: string;
    temperature?: number;
    jsonMode?: boolean;
    allowedCategories?: ('free' | 'paid' | 'local')[]; // Filter which providers to use
}
