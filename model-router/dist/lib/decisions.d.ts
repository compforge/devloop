import { type Classification } from "../domain/routing.js";
import type { Config } from "./config.js";
export declare class DecisionError extends Error {
    readonly code: string;
    constructor(code: string);
}
/**
 * @spec One bounded Decisions request per admitted classification; no retries amplify prompt latency.
 * @why Runtime fetch pools connections; one client owns timeout, cancellation and concurrency for the plugin.
 * @link https://developers.openai.com/api/docs/guides/decisions
 */
export declare class DecisionsClient {
    private readonly config;
    private readonly request;
    private active;
    private readonly controllers;
    private closed;
    constructor(config: Config, request?: typeof fetch);
    classify(input: string): Promise<Classification>;
    close(): void;
}
