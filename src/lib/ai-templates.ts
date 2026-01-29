import { AiProvider } from '@/types/ai';

export const OPENROUTER_TEMPLATE: Omit<AiProvider, 'id' | 'apiKey' | 'enabled'> = {
    name: "OpenRouter",
    type: "openai-compatible",
    provider_category: "paid",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    model: "google/gemini-2.0-flash-001",
    method: "POST",
    headers: {
        "Authorization": "Bearer {{API_KEY}}",
        "HTTP-Referer": "https://newsbyte-bd.com",
        "X-Title": "NewsByte Admin",
        "Content-Type": "application/json"
    },
    body_template: {
        "model": "{{MODEL}}",
        "messages": [
            { "role": "system", "content": "{{SYSTEM_PROMPT}}" },
            { "role": "user", "content": "{{USER_PROMPT}}" }
        ]
    },
    response_path: "choices[0].message.content",
    success_condition: "response.choices && response.choices.length > 0",
    timeout_ms: 30000,
    priority: 3,
    description: "OpenRouter Generic Aggregator"
};

export const OLLAMA_TEMPLATE: Omit<AiProvider, 'id' | 'apiKey' | 'enabled'> = {
    name: "Ollama Local",
    type: "local",
    provider_category: "local",
    endpoint: "http://localhost:11434/api/chat",
    model: "llama3.2",
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body_template: {
        "model": "{{MODEL}}",
        "messages": [
            { "role": "system", "content": "{{SYSTEM_PROMPT}}" },
            { "role": "user", "content": "{{USER_PROMPT}}" }
        ],
        "stream": false
    },
    response_path: "message.content",
    success_condition: "response.message && response.message.content",
    timeout_ms: 45000, // 45 seconds - local providers should be faster
    priority: 10, // Lower priority - use cloud providers first
    description: "Local Ollama Instance (No API Key Required)"
};

export const BYTEZ_TEMPLATE: Omit<AiProvider, 'id' | 'apiKey' | 'enabled'> = {
    name: "Bytez API",
    type: "openai-compatible",
    provider_category: "paid",
    endpoint: "https://api.bytez.com/v1/chat/completions",
    model: "openai-community/gpt-2", // Example model
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "{{API_KEY}}" // Bytez uses direct key in Auth header
    },
    body_template: {
        "model": "{{MODEL}}",
        "messages": [
            { "role": "system", "content": "{{SYSTEM_PROMPT}}" },
            { "role": "user", "content": "{{USER_PROMPT}}" }
        ],
        "stream": false
    },
    response_path: "choices[0].message.content",
    success_condition: "response.choices && response.choices.length > 0",
    timeout_ms: 60000,
    priority: 4,
    description: "Bytez Unified Model API"
};

export const GROQ_TEMPLATE: Omit<AiProvider, 'id' | 'apiKey' | 'enabled'> = {
    name: "Groq Cloud",
    type: "openai-compatible",
    provider_category: "paid", // It has a free tier but requires API key
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer {{API_KEY}}"
    },
    body_template: {
        "model": "{{MODEL}}",
        "messages": [
            { "role": "system", "content": "{{SYSTEM_PROMPT}}" },
            { "role": "user", "content": "{{USER_PROMPT}}" }
        ]
    },
    response_path: "choices[0].message.content",
    success_condition: "response.choices && response.choices.length > 0",
    timeout_ms: 30000,
    priority: 5,
    description: "Groq - The Fast AI Inference"
};

export const HUGGINGFACE_TEMPLATE: Omit<AiProvider, 'id' | 'apiKey' | 'enabled'> = {
    name: "Hugging Face",
    type: "openai-compatible",
    provider_category: "free", // Often free inference API
    endpoint: "https://router.huggingface.co/v1/chat/completions",
    model: "openai/gpt-oss-20b",
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer {{API_KEY}}"
    },
    body_template: {
        "model": "{{MODEL}}",
        "messages": [
            { "role": "system", "content": "{{SYSTEM_PROMPT}}" },
            { "role": "user", "content": "{{USER_PROMPT}}" }
        ],
        "max_tokens": 500,
        "stream": false
    },
    response_path: "choices[0].message.content",
    success_condition: "response.choices && response.choices.length > 0",
    timeout_ms: 45000,
    priority: 6,
    description: "Hugging Face Inference API"
};
