import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type IdentificationResult = {
  kind: "plant" | "fish" | "unknown";
  common_name: string;
  scientific_name?: string;
  confidence: number;
  similar_species?: { common_name: string; scientific_name?: string }[];
  description: string;
  habitat?: string;
  toxicity?: string;
  care_guide: {
    watering?: string;
    sunlight?: string;
    soil?: string;
    fertilizer?: string;
    tank_size?: string;
    ph?: string;
    temperature?: string;
    feeding?: string;
    general?: string;
  };
  disease: {
    detected: boolean;
    name?: string;
    cause?: string;
    severity?: "none" | "mild" | "moderate" | "severe";
    affected_area?: string;
    treatment?: string[];
  };
};

export const analyzeImage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ imageUrl: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_AI_TOKEN;
    if (!accountId || !apiToken) throw new Error("Cloudflare AI credentials missing");

    const prompt = `You are AquaLeaf AI, an expert botanist and aquarist. Analyze this image and identify the plant or fish shown. Return ONLY a valid JSON object with no extra text, no markdown, no code blocks. Just raw JSON:
{
  "kind": "plant",
  "common_name": "name here",
  "scientific_name": "scientific name",
  "confidence": 0.9,
  "similar_species": [{"common_name": "name", "scientific_name": "name"}],
  "description": "detailed description",
  "habitat": "natural habitat",
  "toxicity": "toxicity info or null",
  "care_guide": {
    "watering": "watering info",
    "sunlight": "sunlight needs",
    "soil": "soil type",
    "fertilizer": "fertilizer info",
    "tank_size": "tank size for fish",
    "ph": "pH range",
    "temperature": "temperature range",
    "feeding": "feeding info",
    "general": "general care tips"
  },
  "disease": {
    "detected": false,
    "name": null,
    "cause": null,
    "severity": "none",
    "affected_area": null,
    "treatment": []
  }
}`;

    const imageRes = await fetch(data.imageUrl);
    const imageBuffer = await imageRes.arrayBuffer();
    const imageArray = [...new Uint8Array(imageBuffer)];

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/unum/uform-gen2-qwen-500m`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          image: imageArray,
          max_tokens: 1024,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudflare AI error ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const responseText = json.result?.description ?? json.result?.response ?? "";

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Model returned plain text, build a basic result from it
        return {
          result: {
            kind: "unknown" as const,
            common_name: responseText.slice(0, 50) || "Unknown",
            confidence: 0.5,
            description: responseText,
            care_guide: { general: responseText },
            disease: { detected: false, severity: "none" as const },
          } as IdentificationResult,
        };
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return { result: parsed as IdentificationResult };
    } catch {
      return {
        result: {
          kind: "unknown" as const,
          common_name: "Unknown",
          confidence: 0.5,
          description: responseText || "Could not identify the image",
          care_guide: { general: "Please try again with a clearer image" },
          disease: { detected: false, severity: "none" as const },
        } as IdentificationResult,
      };
    }
  });

export const chatAboutScan = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      imageUrl: z.string().url(),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(40),
      prompt: z.string().min(1).max(2000),
      context: z.string().max(4000).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_AI_TOKEN;
    if (!accountId || !apiToken) throw new Error("Cloudflare AI credentials missing");

    const systemContent =
      "You are AquaLeaf AI assistant. The user is asking follow-up questions about a plant or fish. " +
      "Be concise, friendly, and practical. Use markdown lists for steps." +
      (data.context ? `\n\nContext from prior identification:\n${data.context}` : "");

    const messages = [
      { role: "system", content: systemContent },
      ...data.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: data.prompt },
    ];

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages, max_tokens: 1024 }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudflare AI error ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const reply = json.result?.response;
    if (!reply) throw new Error("Empty AI response");
    return { reply: reply as string };
  });
