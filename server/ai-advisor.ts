import Anthropic from "@anthropic-ai/sdk";

// The newest Anthropic model is "claude-sonnet-4-20250514"
// <important_do_not_delete>
const DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";
// </important_do_not_delete>

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert analytics advisor for a digital marketing team running Facebook/Meta ad campaigns to generate leads for insurance products (Medicare, life insurance, final expense). Your role is strictly data analysis — you examine ad performance metrics, funnel conversion data, and identify actionable insights.

IMPORTANT RULES:
1. Focus ONLY on data analysis and performance insights. Do NOT give unsolicited media buying advice, creative strategy, or budget recommendations unless specifically asked.
2. When presented with metrics data, identify patterns, anomalies, and trends.
3. Use specific numbers from the data. Never fabricate statistics.
4. Compare metrics against each other to find correlations (e.g., high spend + low CTR campaigns).
5. Flag concerning trends: rising CPL, declining conversion rates, high frequency (ad fatigue).
6. Keep responses concise and structured. Use bullet points and tables when helpful.
7. When the user asks about a specific metric, explain what it means in context of their campaign performance.
8. If you don't have enough data to make a conclusion, say so rather than guessing.

METRIC DEFINITIONS YOU KNOW:
- CPL (Cost Per Lead): Total spend divided by leads generated
- Landing Page Conversion Rate: Leads divided by link clicks (percentage)
- Cost Per Call: Spend divided by searches (phone call actions)
- Call Rate: Searches divided by leads (percentage)
- Cost Per Contact: Spend divided by contacts
- Contact Rate: Contacts divided by leads (percentage)
- ThruPlay: Video watched to completion or at least 15 seconds
- Quality/Engagement/Conversion Rankings: Facebook's assessment vs other advertisers (ABOVE_AVERAGE, AVERAGE, BELOW_AVERAGE variants)
- Outbound Clicks: Clicks that take people off Facebook to external destinations
- Frequency: Average times each person saw the ad

You respond in a professional but approachable tone. Format numbers with appropriate symbols ($, %, commas).`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function streamChatResponse(
  messages: ChatMessage[],
  dataContext: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
) {
  try {
    const systemWithContext = dataContext
      ? `${SYSTEM_PROMPT}\n\nCURRENT DATA CONTEXT:\n${dataContext}`
      : SYSTEM_PROMPT;

    const stream = anthropic.messages.stream({
      model: DEFAULT_MODEL_STR,
      max_tokens: 8192,
      system: systemWithContext,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    stream.on("text", (text) => {
      onChunk(text);
    });

    stream.on("end", () => {
      onDone();
    });

    stream.on("error", (err) => {
      onError(err instanceof Error ? err : new Error(String(err)));
    });
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function generateConversationTitle(
  userMessage: string
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL_STR,
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: `Generate a very short title (max 6 words) for a conversation that starts with this question about ad analytics: "${userMessage.slice(0, 200)}". Return ONLY the title, no quotes or punctuation.`,
        },
      ],
    });
    const titleBlock = response.content[0];
    if (titleBlock.type === "text") {
      return titleBlock.text.slice(0, 100);
    }
    return "Analytics Chat";
  } catch {
    return "Analytics Chat";
  }
}

export async function generateInsights(
  dataContext: string
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL_STR,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Based on the following campaign data, provide 3-5 key insights. Focus on: performance anomalies, efficiency opportunities, and concerning trends. Be specific with numbers.\n\nDATA:\n${dataContext}`,
        },
      ],
    });
    const block = response.content[0];
    if (block.type === "text") {
      return block.text;
    }
    return "Unable to generate insights at this time.";
  } catch (err) {
    throw err;
  }
}
