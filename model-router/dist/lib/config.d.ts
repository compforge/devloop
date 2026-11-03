import { type ModelRoutes } from "../domain/routing.js";
export interface Config {
    apiKeyEnv: string;
    baseURL: string;
    timeoutMs: number;
    maxConcurrent: number;
    maxInputChars: number;
    minimumConfidence: number;
    models: ModelRoutes;
}
export declare function configuration(options: Readonly<Record<string, unknown>>): Config;
