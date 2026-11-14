# Model router

Independent OpenCode V2 plugin. `domain/routing.ts` owns complexity-to-model policy;
`lib/decisions.ts` owns the OpenAI Decisions HTTP contract; `adapters/opencode/` owns
host model selection and session routing ownership. Do not import the devloop plugin.

`npm ci` prepares dependencies. `make format lint test` builds and verifies the Component;
`make test-opencode` runs the installed host against local fake Decisions/inference servers.
Keep `dist/` generated and committed. Version is owned by package.json and package-lock.json.

Only explicit Auto or Auto Fast selection enables routing. Auto Fast uses priority variants,
never global model overrides; preserve reasoning settings and the selected mode on fallback/restart.
Never change permission decisions, credentials,
agent selection or tool visibility. Logs contain decisions and identifiers, not input text or secrets.
See README.md for the queue boundary and real API validation limits.
