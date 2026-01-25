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

    // Health Tracking (New)
    failureCount?: number;
    lastFailureAt?: string;
    lastError?: string;
    isHealthy?: boolean; // false = degraded, auto-disabled

    // Cost Tracking (New)
    costPerInputToken?: number;
    costPerOutputToken?: number;
}

export interface AiResponse {
    content: string;
    providerUsed: string;
    modelUsed: string;
    executionTimeMs: number;
    // Enhanced tracking (New)
    estimatedTokens?: number;
}

export interface AiGenerationOptions {
    systemPrompt?: string;
    temperature?: number;
    jsonMode?: boolean;
    allowedCategories?: ('free' | 'paid' | 'local')[]; // Filter which providers to use
    feature?: string; // 'rss_cron' | 'news_generate' | 'test' - for logging
    maxTokens?: number; // Soft cap
}

// Usage Logging (New)
export interface AIUsageLog {
    id?: string;
    timestamp: string;
    providerId: string;
    providerName: string;
    model: string;
    estimatedPromptTokens: number;
    latencyMs: number;
    success: boolean;
    errorMessage?: string;
    feature: string; // 'rss_cron' | 'news_generate' | 'test'
}
