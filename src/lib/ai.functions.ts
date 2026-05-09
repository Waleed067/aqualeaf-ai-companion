import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const IDENTIFY_TOOL = {
  type: "function",
  function: {
    name: "report_identification",
    description: "Return identification, disease assessment, and care guide for the image.",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["plant", "fish", "unknown"] },
        common_name: { type: "string" },
        scientific_name: { type: "string" },
        confidence: { type: "number", description: "0-1" },
        similar_species: {
          type: "array",
          items: {
            type: "object",
            properties: {
              common_name: { type: "string" },
              scientific_name: { type: "string" },
            },
            required: ["common_name"],
          },
        },
        description: { type: "string" },
        habitat: { type: "string" },
        toxicity: { type: "string" },
        care_guide: {
          type: "object",
          properties: {
            watering: { type: "string" },
            sunlight: { type: "string" },
            soil: { type: "string" },
            fertilizer: { type: "string" },
            tank_size: { type: "string" },
            ph: { type: "string" },
            temperature: { type: "string" },
            feeding: { type: "string" },
            general: { type: "string" },
          },
        },
        disease: {
          type: "object",
          properties: {
            detected: { type: "boolean" },
            name: { type: "string" },
            cause: { type: "string" },
            severity: { type: "string", enum: ["none", "mild", "moderate", "severe"] },
            affected_area: { type: "string" },
            treatment: { type: "array", items: { type: "string" } },
          },
          required: ["detected"],
        },
      },
      required: ["kind", "common_name", "confidence", "description", "care_guide", "disease"],
      additionalProperties: false,
    },
  },
} as const;

export const analyzeImage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ imageUrl: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are AquaLeaf AI, an expert botanist and aquarist. Identify plants and fish from photos. " +
              "Detect diseases (fungal/bacterial/viral for plants, parasites/infections for fish). " +
              "Always return data via the report_identification tool. If the image is not a plant or fish, set kind='unknown'.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Identify this and provide full care + disease report." },
              { type: "image_url", image_url: { url: data.imageUrl } },
            ],
          },
        ],
        tools: [IDENTIFY_TOOL],
        tool_choice: { type: "function", function: { name: "report_identification" } },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace settings.");
      throw new Error(`AI gateway ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("AI returned no structured result");
    try {
      return JSON.parse(call.function.arguments) as Record<string, unknown>;
    } catch {
      throw new Error("Failed to parse AI response");
    }
  });

export const chatAboutScan = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        imageUrl: z.string().url(),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
          .max(40),
        prompt: z.string().min(1).max(2000),
        context: z.string().max(4000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const systemContent =
      "You are AquaLeaf AI assistant. The user uploaded an image and is asking follow-up questions. " +
      "Be concise, friendly, and practical. Cite the image when relevant. Use markdown lists for steps." +
      (data.context ? `\n\nContext from prior identification:\n${data.context}` : "");

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemContent },
          {
            role: "user",
            content: [
              { type: "text", text: "Reference image for the conversation:" },
              { type: "image_url", image_url: { url: data.imageUrl } },
            ],
          },
          ...data.history.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: data.prompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI gateway ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const reply = json.choices?.[0]?.message?.content;
    if (!reply) throw new Error("Empty AI response");
    return { reply: reply as string };
  });
