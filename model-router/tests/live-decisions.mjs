import { DecisionsClient } from "../dist/lib/decisions.js";
import { configuration } from "../dist/lib/config.js";

// Explicitly invoked smoke test: synthetic prompts only, never repository content.
if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY in this process before running test-live");
const client = new DecisionsClient(configuration({ timeoutMs: 10_000 }));
const cases = [
  ["simple", "Rename the local variable tmp to count in this one function. Preserve all behavior."],
  ["medium", "Add pagination to an existing REST list endpoint following this project's established handler and database query conventions. Add ordinary unit tests."],
  ["complex", "Diagnose an intermittent distributed deadlock across three services involving retries, leader failover and concurrent schema migration. The logs conflict. Establish root cause and redesign ownership and recovery without data loss."],
];
let failures = 0;
try {
  for (const [expected, input] of cases) {
    const start = Date.now();
    const result = await client.classify(input);
    const matched = result.complexity === expected;
    if (!matched) failures++;
    console.log(JSON.stringify({ expected, ...result, matched, durationMs: Date.now()-start }));
  }
} finally { client.close(); }
if (failures) process.exitCode = 1;
