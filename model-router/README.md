# Model router

An independent OpenCode V2 plugin that uses the OpenAI Decisions API to choose the execution model for each ordinary user prompt.

| Complexity | Default execution model |
| --- | --- |
| Simple: mechanical, local, unambiguous work | `openai/gpt-6.1-terra` |
| Medium: bounded implementation and debugging | `openai/gpt-6.1-sol` |
| Complex: architecture, ambiguous diagnosis, interacting systems | `openai/gpt-6-astra` |

Classification uses `gpt-6-luna` through `POST /v1/decisions`. Classification and inference are separate: OpenCode retains ownership of execution credentials, tools, permissions and its agent loop. The classifier receives the current prompt and bounded recent user/assistant text and compaction summaries so that “fix” can inherit the preceding task's complexity. This rubric is a starting policy; routing quality requires evaluation on your own tasks.

## Install from this checkout

Requires Node.js 22.19+ and OpenCode V2 2.1.2+. V1 and other CLIs are not implemented.

```sh
cd model-router
npm ci
npm run build
```

Set `OPENAI_API_KEY` in the environment of the process that starts OpenCode. A ChatGPT subscription or an OpenCode inference provider login does not by itself supply a Decisions API key. Keep the key outside this repository.

Add the **absolute path to this model-router directory** to `opencode.json(c)`:

```json
{
  "plugins": ["/absolute/path/to/devloop/model-router"],
  "model": "openai/model-router"
}
```

Alternatively select **Auto (Decisions)** under your configured medium model's provider in `/models`. Auto appears only when that provider exposes the medium model. The default mappings require the three OpenAI model IDs to be available in OpenCode. This package has not been published to npm; the `@compforge/model-router/server` export is prepared for publication.

## Routing and manual control

- Selecting Auto explicitly enables routing. Each ordinary prompt is classified once; tool steps reuse that selection. The picker then displays the real routed model, and routing continues for the next prompt.
- Selecting a different real model pauses automatic routing on the next prompt. Select Auto again to resume. Selecting the same model that the router already selected is indistinguishable from keeping it selected.
- Routing ownership survives plugin restart in OpenCode plugin storage. Only the last selected model reference is stored; input text is read from OpenCode's own conversation history.
- A classification timeout, refusal, malformed response, missing key or concurrency saturation falls back to Sol. A simple classification below the confidence threshold also uses Sol. Attachments are counted but their contents are not sent; attachment-bearing or truncated requests cannot route below medium.
- Missing target models fall back to the configured medium model. If that is unavailable too, keep the current selection and log `fallback_unavailable`.
- Auto is an alias of the real medium model, inheriting its transport and credentials. It can execute through Sol even when no classification occurs; it is not a placeholder endpoint.
- **Queue boundary:** OpenCode's `switchModel` is Session-wide. Prompts submitted with `delivery: "queue"` keep the current model and are not classified. Steering inputs may change the model for subsequent steps. This plugin does not claim a separately pinned model for every queued message.
- A newer prompt or a manual selection supersedes an outstanding classification. Plugin unload cancels outstanding API requests. Session deletion clears stored ownership.

## Configuration

Plugin options use OpenCode V2's `{ "package": ..., "options": ... }` syntax:

```json
{
  "plugins": [{
    "package": "/absolute/path/to/devloop/model-router",
    "options": {
      "apiKeyEnv": "OPENAI_API_KEY",
      "baseURL": "https://api.openai.com/v1",
      "timeoutMs": 3000,
      "maxConcurrent": 4,
      "maxInputChars": 24000,
      "minimumConfidence": 0.75,
      "models": {
        "simple": { "providerID": "openai", "id": "gpt-6.1-terra" },
        "medium": { "providerID": "openai", "id": "gpt-6.1-sol" },
        "complex": { "providerID": "openai", "id": "gpt-6-astra" }
      }
    }
  }]
}
```

Model refs can include an optional OpenCode `variant`; the variant must exist in its catalog. Custom gateways must implement the Decisions API contract. `apiKeyEnv` selects an environment variable, never a literal key. HTTPS is required except for loopback tests. Requests have a fixed timeout, no retries, and a bounded in-flight count; the host fetch implementation reuses connections.

Structured stderr logs record session/message IDs, requested tier, confidence, actual target, fallback reason and latency. They do not record prompt text, API keys or API response bodies. The configured Decisions endpoint receives the bounded text input, independently of the execution provider.

## Validation

```sh
make format lint test
make test-opencode              # installed host + local fake APIs, no paid calls
make test-live                  # explicit paid API smoke: 3 synthetic classification prompts
OPENCODE_BIN=/path/to/opencode make test-opencode
```

The host fixture records actual primary model requests and transport model IDs. It checks three routes in one session, classifier failure fallback, conversation context, and queue behavior. Unit tests cover the HTTP schema, deadlines, concurrency, manual override, stale results and restart. Local mock tests prove integration mechanics, not real classifier accuracy or API access.

## Sources and boundaries

- [OpenAI Decisions guide](https://developers.openai.com/api/docs/guides/decisions)
- [Decisions API contract](https://developers.openai.com/api/reference/resources/decisions/methods/create)
- [OpenAI model IDs](https://developers.openai.com/api/docs/guides/latest-model)
- [OpenCode V2 plugin API](https://github.com/anomalyco/opencode/tree/dev/packages/plugin)
- [opencode-classifier-plugin](https://github.com/lucasliet/opencode-classifier-plugin) informed the prompt-hook / model-switch integration. This plugin implements its own bounded complexity policy and OpenAI client; it does not include permission Auto Mode, quota discovery, tool-output filtering or agent routing.
