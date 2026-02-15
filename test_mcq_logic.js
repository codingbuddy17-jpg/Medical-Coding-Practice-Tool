const { expect } = require('assert');

// Mock dependencies
const MCQ_PREFIX = "__MCQ__:";
const CARD_PREFIX = "__CARD__:";

function toMcqOptionKey(value) {
    const raw = String(value || "").trim().toUpperCase();
    if (["A", "B", "C", "D"].includes(raw)) return raw;
    return "";
}

function decodeEmbeddedCard(rawAnswer) {
    const value = String(rawAnswer || "");
    if (!value.startsWith(MCQ_PREFIX)) return null;
    try {
        const parsed = JSON.parse(value.slice(MCQ_PREFIX.length));

        let options = Array.isArray(parsed.options) ? parsed.options : [];
        if (!options.length) {
            options = [parsed.optionA, parsed.optionB, parsed.optionC, parsed.optionD].filter(Boolean);
        }
        options = options.map((x) => String(x || "").trim());

        if (options.length < 2) return null;
        const correctOption = toMcqOptionKey(parsed.correctOption);

        return {
            type: "mcq",
            options: options.slice(0, 4),
            correctOption: correctOption || "",
            rationale: String(parsed.rationale || "").trim()
        };
    } catch {
        return null;
    }
}

// Test Cases
console.log("Testing toMcqOptionKey...");
console.log(`'A' -> '${toMcqOptionKey('A')}'`);
console.log(`'a' -> '${toMcqOptionKey('a')}'`);
console.log(`'A)' -> '${toMcqOptionKey('A)')}'`); // Suspect this fails
console.log(`'Option A' -> '${toMcqOptionKey('Option A')}'`); // Suspect this fails
console.log(`' a ' -> '${toMcqOptionKey(' a ')}'`);

console.log("\nTesting decodeEmbeddedCard with missing correctOption...");
const payloadMissing = JSON.stringify({
    options: ["Opt1", "Opt2", "Opt3", "Opt4"],
    correctOption: "A)", // If toMcqOptionKey fails, this will be empty in the result
    rationale: "Rationale"
});
const decoded = decodeEmbeddedCard(MCQ_PREFIX + payloadMissing);
console.log("Decoded:", JSON.stringify(decoded, null, 2));

if (decoded && decoded.correctOption === "") {
    console.log("\nFAILED: correctOption is empty. Logic needs to be more robust.");
} else {
    console.log("\nPASSED: correctOption is preserved.");
}
