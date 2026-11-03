import { modelRef, type ModelRoutes } from "../domain/routing.js";

export interface Config {
  apiKeyEnv: string;
  baseURL: string;
  timeoutMs: number;
  maxConcurrent: number;
  maxInputChars: number;
  minimumConfidence: number;
  models: ModelRoutes;
}

export function configuration(options: Readonly<Record<string, unknown>>): Config {
  const models: ModelRoutes = {
    simple: { providerID: "openai", id: "gpt-6.1-terra" },
    medium: { providerID: "openai", id: "gpt-6.1-sol" },
    complex: { providerID: "openai", id: "gpt-6-astra" },
  };
  if (options.models !== undefined) {
    if (!options.models || typeof options.models !== "object") throw new Error("model-router: models must be an object");
    for (const tier of ["simple", "medium", "complex"] as const) {
      const value = (options.models as Record<string, unknown>)[tier];
      if (value === undefined) continue;
      const ref = modelRef(value);
      if (!ref) throw new Error(`model-router: invalid models.${tier}`);
      models[tier] = ref;
    }
  }
  function number(key: string, fallback: number, min: number, max: number): number {
    const value = options[key] ?? fallback;
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`model-router: invalid ${key}`);
    return value;
  }
  const baseURL = options.baseURL ?? "https://api.openai.com/v1";
  const apiKeyEnv = options.apiKeyEnv ?? "OPENAI_API_KEY";
  if (typeof baseURL !== "string" || typeof apiKeyEnv !== "string" || !apiKeyEnv) throw new Error("model-router: invalid API configuration");
  const url = new URL(baseURL);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
    throw new Error("model-router: baseURL requires HTTPS (HTTP is allowed for local tests)");
  }
  return {
    apiKeyEnv, baseURL: baseURL.replace(/\/+$/, ""), models,
    timeoutMs: number("timeoutMs", 3000, 100, 30_000),
    maxConcurrent: Math.floor(number("maxConcurrent", 4, 1, 32)),
    maxInputChars: Math.floor(number("maxInputChars", 24_000, 1000, 100_000)),
    minimumConfidence: number("minimumConfidence", 0.75, 0, 1),
  };
}
