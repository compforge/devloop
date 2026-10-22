import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";

const plugin = fileURLToPath(new URL("../../", import.meta.url));
const root = realpathSync(
  mkdtempSync(join(tmpdir(), "devloop-opencode-host-")),
);
const repo = join(root, "repo");
const probe = join(root, "probe");
mkdirSync(repo);
mkdirSync(probe);
mkdirSync(join(root, "config"));
execFileSync("git", ["init", "-q", "-b", "feature", repo]);
execFileSync("git", [
  "-C",
  repo,
  "-c",
  "core.hooksPath=/dev/null",
  "-c",
  "user.name=Test",
  "-c",
  "user.email=test@example.com",
  "commit",
  "-qm",
  "base",
  "--allow-empty",
]);
writeFileSync(
  join(repo, "AGENTS.md"),
  "# Project\n\n## References\n\n- [Design](design.md) — Smoke test reference\n",
);
writeFileSync(join(repo, "design.md"), "# Design\n");
writeFileSync(join(probe, "package.json"), '{"type":"module"}');
let modelStep = 0,
  denyCase = false;
const mock = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  writeFileSync(join(root, "last-model-request.json"), JSON.stringify(body));
  const calls = body.tools?.length && modelStep++ === 0;
  let delta = { content: "Done" },
    reason = "stop";
  if (calls) {
    let code;
    if (denyCase)
      code = 'return await tools.shell({command:"git commit -m forbidden"})';
    else {
      const python =
        'import sys,json,os;sys.path.insert(0,os.environ["PLUGIN_ROOT"]+"/scripts");from domain.context.session import current_identity;from dataclasses import asdict;print(json.dumps(asdict(current_identity())))';
      const command =
        JSON.stringify(plugin + "/scripts/python") +
        " -c " +
        "'" +
        python.replaceAll("'", "'\\''") +
        "'";
      code =
        "const id = await tools.shell({command:" +
        JSON.stringify(command) +
        '}); const write = await tools.write({path:"probe.txt",content:"before\\n"}); const patch = await tools.patch({patchText:"*** Begin Patch\\n*** Update File: probe.txt\\n@@\\n-before\\n+after\\n*** End Patch"}); const failed = await tools.shell({command:"exit 7"}); return {id,write,patch,failed};';
    }
    delta = {
      tool_calls: [
        {
          index: 0,
          id: "call_smoke",
          type: "function",
          function: { name: "execute", arguments: JSON.stringify({ code }) },
        },
      ],
    };
    reason = "tool_calls";
  }
  res.writeHead(200, { "content-type": "text/event-stream" });
  for (const value of [
    {
      id: "chat_smoke",
      object: "chat.completion.chunk",
      created: 1,
      model: "model",
      choices: [
        {
          index: 0,
          delta: { role: "assistant", ...delta },
          finish_reason: null,
        },
      ],
    },
    {
      id: "chat_smoke",
      object: "chat.completion.chunk",
      created: 1,
      model: "model",
      choices: [{ index: 0, delta: {}, finish_reason: reason }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    },
  ])
    res.write("data: " + JSON.stringify(value) + "\n\n");
  res.end("data: [DONE]\n\n");
});
await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
const mockURL = "http://127.0.0.1:" + mock.address().port + "/v1";
const probeSource = `
import { Plugin, Provider, Model } from '@opencode/plugin';
import { appendFileSync } from 'node:fs';
const report = ${JSON.stringify(join(root, "probe.jsonl"))};
export default Plugin.define({ id: 'devloop.probe', async setup(ctx) {
  await ctx.provider.transform(editor => editor.add({
    info: {...Provider.Info.empty(Provider.ID.make('probe')), activation:'enabled', package:'@opencode/ai/providers/openai-compatible',settings:{baseURL:${JSON.stringify(mockURL)},apiKey:'smoke'}},
    models: [Model.Info.default(Provider.ID.make('probe'), Model.ID.make('model'))]
  }));
  // Exercise the native tools through the real CodeMode child-call path.
  await ctx.tool.transform(editor=>{for(const name of ['shell','write','patch'])editor.update(name,tool=>{tool.options={...tool.options,codemode:true}})});
  await ctx.session.hook('context', event => {
    appendFileSync(report, JSON.stringify({kind:'context', session:event.sessionID, system:event.system})+'\\n');
  });
  await ctx.tool.hook('execute.after', event => appendFileSync(report, JSON.stringify({kind:'tool', tool:event.tool, session:event.sessionID, status:event.status, result:event.status === 'completed' ? event.result.output : event.error})+'\\n'));

} });
`;
writeFileSync(join(probe, "server.js"), probeSource);
const config = {
  plugins: [plugin, probe],
  model: "probe/model",
  permissions: [{ action: "*", resource: "*", effect: "allow" }],
};
writeFileSync(join(root, "config/opencode.json"), JSON.stringify(config));
const env = {
  ...process.env,
  XDG_DATA_HOME: join(root, "data"),
  XDG_CACHE_HOME: join(root, "cache"),
  XDG_CONFIG_HOME: join(root, "xdgconfig"),
  XDG_STATE_HOME: join(root, "state"),
  OPENCODE_SERVER_PASSWORD: "devloop-local-smoke-only",
  OPENCODE_CONFIG_DIR: join(root, "config"),
  OPENCODE_TEST_HOME: root,
  OPENCODE_DISABLE_CLAUDE_CODE: "1",
  OPENCODE_DISABLE_MODELS_FETCH: "1",
  OPENCODE_FILEWATCHER_DISABLE: "1",
  npm_config_cache: join(root, "npm-cache"),
  DEVLOOP_CONFIG_DIR: join(root, "devloop-config"),
};
delete env.OPENCODE_CONFIG;
delete env.OPENCODE_CONFIG_CONTENT;
let logs = "";
const child = spawn(
  process.env.DEVLOOP_OPENCODE_BIN || "opencode",
  ["serve", "--hostname", "127.0.0.1", "--port", "0"],
  { cwd: repo, env, stdio: ["ignore", "pipe", "pipe"] },
);
child.stdout.on("data", (data) => {
  logs += data;
});
child.stderr.on("data", (data) => {
  logs += data;
});
const deadline = Date.now() + 45000;
let url;
try {
  while (Date.now() < deadline) {
    const match = logs.match(/http:\/\/127\.0\.0\.1:\d+/);
    if (match) {
      url = match[0];
      break;
    }
    if (child.exitCode !== null)
      throw new Error("server exited: " + logs.slice(-3000));
    await pause(100);
  }
  if (!url) throw new Error("server startup timeout: " + logs.slice(-3000));
  const api = async (
    path,
    body,
    method = body === undefined ? "GET" : "POST",
  ) => {
    const response = await fetch(url + path, {
      method,
      headers: {
        "content-type": "application/json",
        authorization:
          "Basic " +
          Buffer.from("opencode:devloop-local-smoke-only").toString("base64"),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    if (!response.ok)
      throw new Error(path + " " + response.status + " " + text);
    return text ? JSON.parse(text) : null;
  };
  await api("/api/skill?location[directory]=" + encodeURIComponent(repo));
  const sessionIDs = [];
  const heads = [];
  for (const deny of [false, true]) {
    modelStep = 0;
    denyCase = deny;
    if (deny) execFileSync("git", ["-C", repo, "switch", "-c", "main"]);
    const created = await api("/api/session", {
      location: { directory: repo },
      model: { providerID: "probe", id: "model" },
    });
    const id = created.data.id;
    sessionIDs.push(id);
    heads.push(
      execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
    );
    await api("/api/session/" + id + "/prompt", {
      text: deny ? "DENY_CASE" : "IDENTITY_CASE",
    });
    await api("/api/experimental/session/" + id + "/wait", {});
    const session = await api("/api/session/" + id);
    assert.equal(session.data?.outcome, "succeeded");
    assert.equal(
      execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      heads.at(-1),
    );
  }
  const allSkills = (
    await api("/api/skill?location[directory]=" + encodeURIComponent(repo))
  ).data;
  assert.equal(
    allSkills.filter((skill) => skill.id.startsWith("devloop:")).length,
    7,
  );
  const gitSkill = allSkills.find((skill) => skill.id === "devloop:git-ops");
  assert.ok(gitSkill.content.includes(plugin));
  assert.ok(!gitSkill.content.includes("<PLUGIN_ROOT>"));
  const rows = readFileSync(join(root, "probe.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  for (const id of sessionIDs) {
    const contexts = rows.filter(
      (row) => row.kind === "context" && row.session === id,
    );
    assert.ok(contexts.length >= 2);
    assert.ok(
      contexts.every((row) =>
        row.system.some(
          (part) =>
            part.text?.startsWith("Repo AGENTS") &&
            part.text.includes("design.md"),
        ),
      ),
    );
  }
  const shell = rows.find(
    (row) =>
      row.kind === "tool" && row.tool === "shell" && row.result?.exit === 0,
  );
  const identity = JSON.parse(shell.result.output.trim().split("\n").at(-1));
  assert.deepEqual(identity, {
    harness: "opencode",
    session_id: sessionIDs[0],
  });
  assert.equal(readFileSync(join(repo, "probe.txt"), "utf8"), "after\n");
  const denied = rows.find(
    (row) =>
      row.kind === "tool" &&
      row.tool === "execute" &&
      row.session === sessionIDs[1],
  );
  assert.equal(denied.result.error, true);
  assert.match(denied.result.output, /protected branch/);
  const ledger = readFileSync(join(repo, ".devloop/tool-calls.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.ok(
    ledger.some(
      (row) =>
        row.tool === "shell" &&
        row.outcome === "failed" &&
        row.session_id === sessionIDs[0],
    ),
  );
  assert.ok(
    ledger.some(
      (row) =>
        row.tool === "execute" &&
        row.outcome === "failed" &&
        row.session_id === sessionIDs[1],
    ),
  );
  assert.ok(!existsSync(join(repo, ".devloop/owner.lock")));
  const summary = {
    skills: 7,
    modelContexts: rows.filter((row) => row.kind === "context").length,
    pythonIdentity: true,
    patchApplied: true,
    protectedCommitDenied: true,
    shellFailureRecorded: true,
    ownersReleased: true,
  };
  writeFileSync(
    join(root, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );
  console.log(JSON.stringify(summary));
} finally {
  child.kill("SIGTERM");
  mock.close();
  await new Promise((resolve) => {
    if (child.exitCode !== null) resolve();
    else {
      child.once("exit", resolve);
      setTimeout(() => child.kill("SIGKILL"), 3000).unref();
    }
  });
  writeFileSync(join(root, "server.log"), logs);
  console.log(JSON.stringify({ evidence: root }));
}
