import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Generate an AI-powered fix suggestion for an accessibility violation.
 * Returns null if the API key is not configured or the call fails.
 */
export async function generateAiFixSuggestion(params: {
  ruleId: string;
  description: string;
  htmlElement: string;
  helpText: string;
  templateFix?: string;
}): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You are an expert web accessibility engineer. A developer needs a concise, actionable fix for the following WCAG violation.

**Rule:** ${params.ruleId}
**Issue:** ${params.description}
**Affected HTML:**
\`\`\`html
${params.htmlElement}
\`\`\`
**Context:** ${params.helpText}
${params.templateFix ? `\n**General guidance:** ${params.templateFix}` : ""}

Provide a specific fix for this exact HTML element. Show the corrected HTML if applicable. Be concise (3-6 sentences max). Do not repeat the problem — focus only on the solution.`,
        },
      ],
    });

    const content = message.content[0];
    return content?.type === "text" ? content.text.trim() : null;
  } catch (err) {
    console.error("[AI Fix] Generation failed:", err);
    return null;
  }
}
