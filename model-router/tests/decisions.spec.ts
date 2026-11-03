import { afterEach, describe, expect, it, vi } from "vitest";
import { configuration } from "../lib/config.js";
import { DecisionsClient } from "../lib/decisions.js";
import { routeFor } from "../domain/routing.js";

afterEach(() => vi.unstubAllEnvs());
const response = (choice: string, confidence = 0.95) => Response.json({ answers: [{ type: "choice", name: "complexity", choice, confidence }] });

describe("Decisions API contract", () => {
  it.each(["simple", "medium", "complex"])("decodes the %s route and sends the documented request", async (tier) => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(tier));
    const client = new DecisionsClient(configuration({}), request);
    expect(await client.classify("Fix the race condition")).toEqual({ complexity: tier, confidence: 0.95 });
    const [url, options] = request.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/decisions");
    expect(options?.headers).toMatchObject({ authorization: "Bearer test-key" });
    expect(JSON.parse(String(options?.body))).toMatchObject({ model: "gpt-6-luna", input: "Fix the race condition", questions: [{ type: "choice", name: "complexity" }] });
    expect(options?.redirect).toBe("error");
  });
  it.each([
    { answers: [{ type: "refusal", name: "complexity" }] },
    { answers: [] },
    { answers: [{ type: "choice", name: "other", choice: "simple", confidence: 1 }] },
    { answers: [{ type: "choice", name: "complexity", choice: "unknown", confidence: 1 }] },
    { answers: [{ type: "choice", name: "complexity", choice: "simple", confidence: 2 }] },
  ])("rejects malformed or refused decisions", async (data) => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const client = new DecisionsClient(configuration({}), vi.fn<typeof fetch>().mockResolvedValue(Response.json(data)));
    await expect(client.classify("hello")).rejects.toThrow();
  });
  it("does not call the API without a key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const request = vi.fn<typeof fetch>();
    await expect(new DecisionsClient(configuration({}), request).classify("hello")).rejects.toThrow("missing_api_key");
    expect(request).not.toHaveBeenCalled();
  });
  it("bounds concurrency and cancels outstanding requests on unload", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const request = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const client = new DecisionsClient(configuration({ maxConcurrent: 1 }), request);
    const first = client.classify("first");
    await expect(client.classify("second")).rejects.toThrow("capacity");
    client.close();
    await expect(first).rejects.toThrow("timeout_or_cancelled");
    await expect(client.classify("third")).rejects.toThrow("closed");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("times out without retries", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const request = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    await expect(new DecisionsClient(configuration({ timeoutMs: 100 }), request).classify("hello")).rejects.toThrow("timeout_or_cancelled");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("surfaces HTTP status without server response text", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const client = new DecisionsClient(configuration({}), vi.fn<typeof fetch>().mockResolvedValue(new Response("sensitive echo", { status: 429 })));
    await expect(client.classify("hello")).rejects.toThrow(/^http_429$/);
  });
});

it("only downgrades to Terra with sufficient confidence", () => {
  expect(routeFor({ complexity: "simple", confidence: 0.6 }, 0.75)).toBe("medium");
  expect(routeFor({ complexity: "simple", confidence: 0.9 }, 0.75)).toBe("simple");
  expect(routeFor({ complexity: "complex", confidence: 0.5 }, 0.75)).toBe("complex");
});
it("validates configuration before any request", () => {
  expect(() => configuration({ baseURL: "http://example.com/v1" })).toThrow();
  expect(() => configuration({ models: { simple: "typo" } })).toThrow();
  expect(configuration({ baseURL: "http://127.0.0.1:1234/v1/" }).baseURL).toBe("http://127.0.0.1:1234/v1");
});
