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

async function fetchImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const analyzeImage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ imageUrl: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_AI_TOKEN;
    if (!accountId || !apiToken) throw new Error("Cloudflare AI credentials missing");

    const base64Image = await fetchImageAsBase64(data.imageUrl);

    const prompt = `You are AquaLeaf AI, an expert botanist and aquarist. Analyze this image and identify the plant or fish shown.
    
Return a JSON object with exactly this structure (no extra text, just JSON):
{
  "kind": "plant" or "fish" or "unknown",
  "common_name": "name here",
  "scientific_name": "scientific name if known",
  "confidence": 0.9,
  "similar_species": [{"common_name": "name", "scientific_name": "name"}],
  "description": "detailed description",
  "habitat": "natural habitat",
  "toxicity": "toxicity info if any",
  "care_guide": {
    "watering": "watering info for plants",
    "sunlight": "sunlight needs for plants",
    "soil": "soil type for plants",
    "fertilizer": "fertilizer info",
    "tank_size": "tank size for fish",
    "ph": "pH range for fish",
    "temperature": "temperature range",
    "feeding": "feeding info for fish",
    "general": "general care tips"
  },
  "disease": {
    "detected": false,
    "name": "disease name if detected",
    "cause": "cause if detected",
    "severity": "none",
    "affected_area": "affected area if detected",
    "treatment": ["treatment steps if detected"]
  }
}`;

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/llava-1.5-7b-hf`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          image: [...new Uint8Array(await (await fetch(data.imageUrl)).arrayBuffer())],
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudflare AI error ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const responseText = json.result?.response ?? "";
    
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      const parsed = JSON.parse(jsonMatch[0]);
      return { result: parsed as IdentificationResult };
    } catch {
      throw new Error("Failed to parse AI response");
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
      "You are AquaLeaf AI assistant. The user uploaded an image and is asking follow-up questions. " +
      "Be concise, friendly, and practical. Use markdown lists for steps." +
      (data.context ? `\n\nContext from prior identification:\n${data.context}` : "");

    const messages = [
      { role: "system", content: systemContent },
      ...data.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: data.prompt },
    ];

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/mistral/mistral-7b-instruct-v0.1`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
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
