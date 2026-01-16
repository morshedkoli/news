export interface SummarizedNews {
    title: string;
    summary: string;
}

const PRIMARY_MODEL = "qwen2.5:7b";
const FALLBACK_MODEL = "llama3.1:8b";
const MAX_RETRIES = 1;

// Configuration for low-hallucination generation
const GENERATION_OPTIONS = {
    temperature: 0.2, // Very strict
    top_p: 0.9,
    top_k: 40,
    repeat_penalty: 1.15,
    num_predict: 350, // Max tokens
};

export async function checkOllamaHealth(): Promise<boolean> {
    const endpoint = process.env.NEXT_PUBLIC_OLLAMA_API_URL || "http://localhost:11434";
    try {
        const res = await fetch(`${endpoint}/api/tags`, {
            signal: AbortSignal.timeout(5000)
        });
        return res.ok;
    } catch (e) {
        console.error("Ollama Health Check Failed:", e);
        return false;
    }
}

export async function summarizeNews(text: string): Promise<SummarizedNews> {
    const endpoint = process.env.NEXT_PUBLIC_OLLAMA_API_URL || "http://localhost:11434";

    // Attempt with Primary Model first
    try {
        console.log(`Attempting summarization with ${PRIMARY_MODEL}...`);
        return await generateWithModel(endpoint, PRIMARY_MODEL, text);
    } catch (primaryError) {
        console.warn(`${PRIMARY_MODEL} failed, switching to fallback ${FALLBACK_MODEL}. Error:`, primaryError);

        // Attempt with Fallback Model
        try {
            return await generateWithModel(endpoint, FALLBACK_MODEL, text);
        } catch (fallbackError) {
            console.error("All models failed to generate valid summary.");
            throw fallbackError;
        }
    }
}

async function generateWithModel(endpoint: string, model: string, text: string): Promise<SummarizedNews> {
    const systemPrompt = `You are a professional Bangla news editor.
Rules:
- Write in Bangla only
- Neutral journalistic tone
- No opinions, no analysis, no emotion
- No clickbait
- Do NOT add new facts or guess missing info
- Use short paragraphs (max 6 paragraphs, max 2 lines each)
- Max 120 words total

Output format JSON ONLY:
{
  "title": "Clean Bangla Title",
  "summary": "Bangla Summary..."
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

    try {
        const response = await fetch(`${endpoint}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: model,
                system: systemPrompt,
                prompt: `নিচের সংবাদটি সংক্ষেপে উপস্থাপন করুন। মূল তথ্য ঠিক রাখুন। কোনো মতামত দেবেন না।\n\nসংবাদ:\n${text}`,
                format: "json",
                stream: false,
                options: GENERATION_OPTIONS,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json();
        const parsed = parseAndValidateResponse(data.response);
        return parsed;

    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

function parseAndValidateResponse(responseString: string): SummarizedNews {
    let parsed: any;
    try {
        // Handle common markdown code block wrapping
        const clean = responseString.replace(/```json/g, "").replace(/```/g, "").trim();
        parsed = JSON.parse(clean);
    } catch (e) {
        throw new Error("Failed to parse JSON response");
    }

    if (!parsed.title || !parsed.summary) {
        throw new Error("Invalid JSON structure: missing title or summary");
    }

    // Validation 1: Check for Bangla Content (Simple heuristic: must NOT differ significantly in English usage)
    if (isMostlyEnglish(parsed.title) || isMostlyEnglish(parsed.summary)) {
        throw new Error("Validation Failed: Output contains too much English");
    }

    // Validation 2: Hallucination/Bias check (Simulated by checking for forbidden phrases)
    const forbiddenPhrases = ["As an AI", "I cannot", "AI model", "artificial intelligence"];
    const combinedText = (parsed.title + parsed.summary).toLowerCase();
    if (forbiddenPhrases.some(phrase => combinedText.includes(phrase.toLowerCase()))) {
        throw new Error("Validation Failed: Output contains AI refusal or hallucination");
    }

    // Validation 3: Length Check
    const wordCount = parsed.summary.split(/\s+/).length;
    if (wordCount > 150) { // Slight buffer over 120
        throw new Error("Validation Failed: Summary too long");
    }

    return {
        title: cleanText(parsed.title),
        summary: cleanText(parsed.summary)
    };
}

function isMostlyEnglish(text: string): boolean {
    const englishWordCount = (text.match(/[a-zA-Z]+/g) || []).length;
    const totalWords = text.split(/\s+/).length;
    // Allow up to 20% English (names, technical terms)
    return (englishWordCount / totalWords) > 0.2;
}

function cleanText(text: string): string {
    return text
        .replace(/\r\n/g, "\n")
        .replace(/\n\s*\n/g, "\n\n") // Normalize paragraphs
        .trim();
}
