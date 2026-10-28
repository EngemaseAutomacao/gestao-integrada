import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { getFile } from "../lib/storage.js";

/**
 * Leitura automática do hodômetro a partir das fotos do painel (saída e chegada).
 *
 * Substitui a chamada ao "Lovable AI Gateway" (Gemini), que só funcionava dentro
 * do Lovable. Agora usa a API da Anthropic (ANTHROPIC_API_KEY).
 * Qualquer falha retorna leitura nula com confiança "low" — a devolução nunca é bloqueada.
 */

const OdometerSchema = z.object({
  checkout_km: z.number().nullable(),
  checkin_km: z.number().nullable(),
  distance_km: z.number().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string(),
});

export type OdometerResult = z.infer<typeof OdometerSchema>;

const FALLBACK_RESULT = (notes: string): OdometerResult => ({
  checkout_km: null,
  checkin_km: null,
  distance_km: null,
  confidence: "low",
  notes,
});

const SYSTEM_PROMPT = `Você lê hodômetros de veículos a partir de fotos do painel.
Receberá duas fotos: a primeira é da SAÍDA e a segunda é da DEVOLUÇÃO.
Leia a quilometragem total (hodômetro, não o trip/parcial) de cada foto e calcule a distância percorrida.
Regras:
- Se não conseguir ler um valor com segurança, use null.
- KM de devolução igual ao de saída é válido: distance_km = 0, com a confiança baseada na legibilidade.
- Só quando o KM de devolução for MENOR que o de saída, use confidence "low" e explique em notes.
- notes: explicação curta em português.`;

type ImageMedia = "image/jpeg" | "image/png" | "image/webp";

async function loadImage(storagePath: string): Promise<{ data: string; media_type: ImageMedia } | null> {
  const file = await getFile(storagePath);
  if (!file) return null;
  const buf = Buffer.isBuffer(file.body) ? file.body : Buffer.from(await new Response(file.body).arrayBuffer());
  const type = file.contentType.toLowerCase();
  const media_type: ImageMedia = type.includes("png") ? "image/png" : type.includes("webp") ? "image/webp" : "image/jpeg";
  return { data: buf.toString("base64"), media_type };
}

let client: Anthropic | null = null;

export async function readOdometer(checkoutPhotoPath: string, checkinPhotoPath: string): Promise<OdometerResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return FALLBACK_RESULT("Leitura automática indisponível (ANTHROPIC_API_KEY não configurada). Informe o KM manualmente.");
  }

  const [before, after] = await Promise.all([loadImage(checkoutPhotoPath), loadImage(checkinPhotoPath)]);
  if (!before || !after) {
    return FALLBACK_RESULT("Não foi possível carregar as fotos do painel. Informe o KM manualmente.");
  }

  client ??= new Anthropic({ timeout: 60_000, maxRetries: 1 });

  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Foto 1 — SAÍDA:" },
            { type: "image", source: { type: "base64", ...before } },
            { type: "text", text: "Foto 2 — DEVOLUÇÃO:" },
            { type: "image", source: { type: "base64", ...after } },
            { type: "text", text: "Leia o hodômetro das duas fotos e calcule a distância percorrida." },
          ],
        },
      ],
      output_config: { format: betaZodOutputFormat(OdometerSchema) },
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return FALLBACK_RESULT("Não foi possível interpretar a leitura. Por favor, informe a quilometragem manualmente.");
    }
    const result = response.parsed_output;
    // Recalcula a distância no servidor em vez de confiar na aritmética do modelo.
    if (typeof result.checkout_km === "number" && typeof result.checkin_km === "number") {
      result.distance_km = result.checkin_km - result.checkout_km;
      if (result.distance_km < 0) result.confidence = "low";
    }
    return result;
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      console.error("[odometer] limite de taxa da API Anthropic");
    } else if (err instanceof Anthropic.APIError) {
      console.error(`[odometer] erro da API Anthropic ${err.status}:`, err.message);
    } else {
      console.error("[odometer] erro inesperado:", err);
    }
    return FALLBACK_RESULT("Serviço de leitura indisponível no momento. Informe o KM manualmente.");
  }
}
