
const cases = [
    {
        name: "Valid JSON",
        input: '{"title": "Valid", "summary": "Valid Summary", "category": "Test"}'
    },
    {
        name: "Markdown Block",
        input: '```json\n{"title": "MD", "summary": "MD Summary", "category": "Test"}\n```'
    },
    {
        name: "Unescaped Newlines",
        input: '{"title": "Newlines", "summary": "Line 1\nLine 2", "category": "Test"}'
    },
    {
        name: "Unterminated String (Simulated)",
        input: '{"title": "Broken", "summary": "Broken...'
    },
    {
        name: "Regex Fallback Target",
        input: 'Here is JSON:\n"title": "Regex Title",\n"summary": "Regex Summary",\n"category": "Test"'
    }
];

function testParsing(input: string) {
    console.log(`\n--- Testing: ${input.substring(0, 50)}... ---`);

    let clean = input
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');

    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        clean = clean.substring(firstOpen, lastClose + 1);
    }

    try {
        const res = JSON.parse(clean);
        console.log("✅ JSON Parse Success:", res);
        return;
    } catch (parseErr: any) {
        console.log("⚠️ Parse 1 Failed:", parseErr.message);

        try {
            const cleaner = clean.replace(/\n/g, "\\n");
            const res = JSON.parse(cleaner);
            console.log("✅ JSON Parse Fix Success:", res);
            return;
        } catch (e2) {
            console.log("⚠️ Parse 2 Failed. Trying Regex...");

            const titleMatch = clean.match(/"title"\s*:\s*"([^"]*?)"/);
            const summaryMatch = clean.match(/"summary"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"|\s*})/);
            const categoryMatch = clean.match(/"category"\s*:\s*"([^"]*?)"/);

            if (summaryMatch) {
                console.log("✅ Regex Success:", {
                    title: titleMatch ? titleMatch[1] : "Fallback",
                    summary: summaryMatch[1].replace(/\\n/g, '\n').trim(),
                    category: categoryMatch ? categoryMatch[1] : "Fallback"
                });
            } else {
                console.log("❌ All Methods Failed");
            }
        }
    }
}

cases.forEach(c => {
    console.log(`\n[CASE: ${c.name}]`);
    testParsing(c.input);
});
