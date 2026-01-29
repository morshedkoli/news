export interface AiModelConfig {
    id: string; // e.g., 'mistral-7b', 'gemini-flash'
    name: string; // Display Name
    enabled: boolean;
    priority: number; // 1 = High, 10 = Low

    // Health Tracking (Per Model)
    healthScore?: number;
    healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
    healthReason?: string;
    pausedUntil?: string;

    stats?: {
        totalRequests: number;
        successRate: number;
        avgLatencyMs: number;
        lastUpdated: string;
    };

    costPerInputToken?: number;
    costPerOutputToken?: number;
}

export interface AiProvider {
    id: string;
    name: string;
    description?: string;
    // 'local' and 'openai-compatible' are kept for backward compatibility but mapped to generic logic
    type: 'local' | 'openai-compatible' | 'custom';
    provider_category: 'free' | 'paid' | 'local';
    endpoint: string;
    apiKey?: string; // Stored securely
    method?: 'POST' | 'GET'; // Restored

    // Model Configuration (Multi-Model Support)
    models?: AiModelConfig[];

    // Legacy / Deprecated (will migrate to models[])
    model: string;

    // ... existing fields ...
    priority?: number;
    enabled?: boolean;
    timeout_ms?: number;

    headers?: Record<string, string>;
    body_template?: any;
    success_condition?: string;
    response_path?: string;

    // Provider-Level Health (Aggregated or Gateway Health)
    failureCount?: number;
    lastFailureAt?: string;
    lastError?: string;
    isHealthy?: boolean;

    // Health Score System (0-100)
    healthScore?: number;
    healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
    healthReason?: string;
    pausedUntil?: string;

    // Provider Stats
    stats?: {
        totalRequests: number;
        successRate: number;
        avgLatencyMs: number;
        lastUpdated: string;
    };
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
