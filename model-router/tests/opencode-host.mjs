import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as pause } from "node:timers/promises";

const plugin = fileURLToPath(new URL("../", import.meta.url));
const root = realpathSync(mkdtempSync(join(tmpdir(), "model-router-host-")));
const repo = join(root, "repo"), probe = join(root, "probe"), report = join(root, "requests.jsonl");
for (const dir of [repo, probe, join(root, "config")]) mkdirSync(dir);
const decisions = [], inference = [];
const mock = createServer(async (req, res) => {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  if (req.url === "/v1/decisions") {
    decisions.push(body);
    const current = body.input.split("Current user request:\n")[1];
    if (current.startsWith("FAIL")) { res.writeHead(503); res.end("unavailable"); return; }
    const choice = current.startsWith("COMPLEX") ? "complex" : current.startsWith("MEDIUM") ? "medium" : "simple";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ answers: [{ type: "choice", name: "complexity", choice, confidence: 0.99 }] })); return;
  }
  inference.push(body);
  if (JSON.stringify(body.messages).includes("REJECT_PRIORITY") && body.tools?.some(tool => tool.function?.name === "router_probe")) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Priority is unavailable for this test account", type: "invalid_request_error", code: "unsupported_service_tier" } }));
    return;
  }
  res.writeHead(200, { "content-type": "text/event-stream" });
  const tool = JSON.stringify(body.messages).includes("TOOL continuation") && !body.messages.some(message => message.role === "tool")
    && body.tools?.some(tool => tool.function?.name === "router_probe");
  const chunksOut = tool ? [[{ role: "assistant", tool_calls: [{ index: 0, id: "call_probe", type: "function", function: { name: "router_probe", arguments: "{}" } }] }, null], [{}, "tool_calls"]]
    : [[{ role: "assistant", content: "Done" }, null], [{}, "stop"]];
  for (const [delta, finish_reason] of chunksOut) {
    res.write("data: " + JSON.stringify({ id: "chat_test", object: "chat.completion.chunk", created: 1, model: body.model, choices: [{ index: 0, delta, finish_reason }] }) + "\n\n");
  }
  res.end("data: [DONE]\n\n");
});
await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
const baseURL = `http://127.0.0.1:${mock.address().port}/v1`;
writeFileSync(join(probe, "package.json"), '{"type":"module"}');
writeFileSync(join(probe, "server.js"), `
import { Plugin, Provider, Model } from '@opencode/plugin';
import { appendFileSync } from 'node:fs';
export default Plugin.define({ id:'model-router.probe', async setup(ctx) {
  await ctx.provider.transform(editor => editor.add({
    info: {...Provider.Info.empty(Provider.ID.make('probe')), activation:'enabled', package:'@opencode/ai/providers/openai-compatible', settings:{baseURL:${JSON.stringify(baseURL)},apiKey:'local'}},
    models: ['terra','sol','astra'].map(id=>Model.Info.default(Provider.ID.make('probe'),Model.ID.make(id)))
  }));
  // Expose directly rather than behind Code Mode so the fake model can invoke it.
  await ctx.tool.transform(editor => editor.add({name:'router_probe',description:'Local test tool',input:{type:'object',properties:{}},options:{codemode:false},execute:async()=>({content:'probe completed'})}));
  await ctx.session.hook('model.request', event => { if(event.kind==='primary') appendFileSync(${JSON.stringify(report)}, JSON.stringify({session:event.sessionID,model:event.model})+'\\n'); });
}});
`);
const models = Object.fromEntries([['simple','terra'],['medium','sol'],['complex','astra']].map(([tier,id]) => [tier,{providerID:'probe',id}]));
writeFileSync(join(root, "config/opencode.json"), JSON.stringify({
  plugins: [probe, { package: plugin, options: { models, baseURL, apiKeyEnv: "MODEL_ROUTER_TEST_KEY" } }],
  model: "probe/model-router",
}));
const env = { ...process.env,
  XDG_DATA_HOME: join(root,"data"), XDG_CACHE_HOME: join(root,"cache"), XDG_CONFIG_HOME: join(root,"xdgconfig"), XDG_STATE_HOME: join(root,"state"),
  OPENCODE_CONFIG_DIR: join(root,"config"), OPENCODE_TEST_HOME: root,
  OPENCODE_SERVER_PASSWORD: "local-router-test", OPENCODE_DISABLE_CLAUDE_CODE:"1", OPENCODE_DISABLE_MODELS_FETCH:"1", OPENCODE_FILEWATCHER_DISABLE:"1",
  MODEL_ROUTER_TEST_KEY:"local", npm_config_cache:join(root,"npm-cache"),
};
delete env.OPENCODE_CONFIG; delete env.OPENCODE_CONFIG_CONTENT; delete env.OPENAI_API_KEY;
const child = spawn(process.env.OPENCODE_BIN || "opencode", ["serve","--hostname","127.0.0.1","--port","0"], { cwd:repo,env,stdio:["ignore","pipe","pipe"] });
let logs = ""; child.stdout.on("data", data=>{logs+=data}); child.stderr.on("data",data=>{logs+=data});
try {
  let url;
  const deadline = Date.now()+45_000;
  while(Date.now()<deadline) {
    url = logs.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    if(url) break;
    if(child.exitCode!==null) throw new Error(`Host exited: ${logs.slice(-2500)}`);
    await pause(100);
  }
  assert(url, "host startup timeout");
  const api = async (path, body) => {
    const response = await fetch(url+path,{ method:body===undefined?'GET':'POST', signal:AbortSignal.timeout(30_000),headers:{'content-type':'application/json',authorization:'Basic '+Buffer.from('opencode:local-router-test').toString('base64')},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const text = await response.text(); assert(response.ok, `${path}: ${response.status}: ${text}`); return text?JSON.parse(text):null;
  };
  const catalog = (await api('/api/model?location[directory]='+encodeURIComponent(repo))).data;
  // Model inventory can precede asynchronous plugin settlement.
  let available = catalog;
  for(let i=0;i<50 && !available.some(m=>m.providerID==='probe'&&m.id==='model-router');i++) {
    await pause(100); available=(await api('/api/model?location[directory]='+encodeURIComponent(repo))).data;
  }
  assert(available.some(m=>m.id==='model-router'&&m.modelID==='sol'), 'Auto alias must inherit Sol');
  assert(available.some(m=>m.id==='model-router-fast'&&m.name==='Auto Fast (Decisions)'&&m.modelID==='sol'), 'Auto Fast must be a separate picker entry');
  assert.equal(available.filter(m=>m.providerID==='probe'&&m.id.startsWith('model-router')).length,2,'only two Auto models in the picker');
  const session=(await api('/api/session',{location:{directory:repo},model:{providerID:'probe',id:'model-router'}})).data.id;
  for(const [text,expected] of [['SIMPLE rename','terra'],['MEDIUM implement','sol'],['COMPLEX investigate','astra'],['FAIL classification','sol']]) {
    await api(`/api/session/${session}/prompt`,{text});
    await api(`/api/experimental/session/${session}/wait`,{});
    const current=(await api(`/api/session/${session}`)).data;
    assert.equal(current.outcome,'succeeded'); assert.equal(current.model.id,expected);
    const requests=readFileSync(report,'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(requests.at(-1).model.id,expected, 'the current primary request must use the route');
    assert.equal(inference.at(-1).model,expected, 'actual transport must receive the target model');
    assert.equal(inference.at(-1).service_tier,undefined,'ordinary Auto must not enable priority');
  }
  assert.equal(decisions.length,4);
  await api(`/api/session/${session}/model`,{model:{providerID:'probe',id:'astra'}});
  await api(`/api/session/${session}/prompt`,{text:'SIMPLE manual pin'});
  await api(`/api/experimental/session/${session}/wait`,{});
  assert.equal(decisions.length,4, 'manual model choice must stop routing');
  assert.equal((await api(`/api/session/${session}`)).data.model.id,'astra');
  assert(decisions[1].input.includes('SIMPLE rename'), 'previous user task must reach classification');
  const queued=(await api('/api/session',{location:{directory:repo},model:{providerID:'probe',id:'model-router'}})).data.id;
  await api(`/api/session/${queued}/prompt`,{text:'COMPLEX queued',delivery:'queue'});
  await api(`/api/experimental/session/${queued}/wait`,{});
  assert.equal(decisions.length,4, 'queue admission must not classify or switch');
  assert.equal((await api(`/api/session/${queued}`)).data.outcome,'succeeded');
  assert.equal(inference.at(-1).model,'sol','Auto is a working fallback without classification');

  const fast=(await api('/api/session',{location:{directory:repo},model:{providerID:'probe',id:'model-router-fast'}})).data.id;
  for(const [text,expected] of [['SIMPLE fast','terra'],['MEDIUM fast','sol'],['COMPLEX fast','astra'],['FAIL fast','sol']]) {
    await api(`/api/session/${fast}/prompt`,{text});
    await api(`/api/experimental/session/${fast}/wait`,{});
    const current=(await api(`/api/session/${fast}`)).data;
    assert.equal(current.outcome,'succeeded');
    assert.equal(current.model.id,expected);
    assert.equal(current.model.variant,'model-router-fast');
    const requests=readFileSync(report,'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(requests.at(-1).model.variant,'model-router-fast');
    assert.equal(inference.at(-1).model,expected,'Fast must preserve the real transport model ID');
    assert.equal(inference.at(-1).service_tier,'priority','each Fast route and fallback must send priority');
  }
  assert.equal(decisions.length,8);
  // Multiple primary requests caused by a real tool step must retain priority,
  // while classification still happens once at prompt admission.
  const beforeSteps=inference.length;
  await api(`/api/session/${fast}/prompt`,{text:'MEDIUM TOOL continuation'});
  await api(`/api/experimental/session/${fast}/wait`,{});
  const steps=inference.slice(beforeSteps).filter(body=>body.tools?.some(tool=>tool.function?.name==='router_probe'));
  assert(steps.length>=2,'tool invocation must cause another primary request');
  assert(steps.every(body=>body.model==='sol'&&body.service_tier==='priority'),'all tool steps retain Fast');
  assert.equal(decisions.length,9,'tool continuations must not reclassify');

  await api(`/api/session/${fast}/model`,{model:{providerID:'probe',id:'model-router'}});
  await api(`/api/session/${fast}/prompt`,{text:'SIMPLE ordinary again'});
  await api(`/api/experimental/session/${fast}/wait`,{});
  assert.equal(inference.at(-1).model,'terra');
  assert.equal(inference.at(-1).service_tier,undefined,'switching to Auto removes Fast');
  await api(`/api/session/${fast}/model`,{model:{providerID:'probe',id:'model-router-fast'}});
  await api(`/api/session/${fast}/prompt`,{text:'COMPLEX fast again'});
  await api(`/api/experimental/session/${fast}/wait`,{});
  assert.equal(inference.at(-1).service_tier,'priority');
  await api(`/api/session/${fast}/model`,{model:{providerID:'probe',id:'sol'}});
  await api(`/api/session/${fast}/prompt`,{text:'SIMPLE manual after Fast'});
  await api(`/api/experimental/session/${fast}/wait`,{});
  assert.equal(decisions.length,11,'manual selection must pause Fast routing');
  assert.equal(inference.at(-1).model,'sol');
  assert.equal(inference.at(-1).service_tier,undefined,'manual model settings remain unchanged');

  const queuedFast=(await api('/api/session',{location:{directory:repo},model:{providerID:'probe',id:'model-router-fast'}})).data.id;
  await api(`/api/session/${queuedFast}/prompt`,{text:'COMPLEX queued Fast',delivery:'queue'});
  await api(`/api/experimental/session/${queuedFast}/wait`,{});
  assert.equal(decisions.length,11,'Fast queue admission must not classify');
  assert.equal((await api(`/api/session/${queuedFast}`)).data.outcome,'succeeded');
  assert.equal(inference.at(-1).model,'sol');
  assert.equal(inference.at(-1).service_tier,'priority','queued Auto Fast must execute medium with priority');

  const rejected=(await api('/api/session',{location:{directory:repo},model:{providerID:'probe',id:'model-router-fast'}})).data.id;
  const beforeRejection=inference.length;
  await api(`/api/session/${rejected}/prompt`,{text:'MEDIUM REJECT_PRIORITY'});
  await api(`/api/experimental/session/${rejected}/wait`,{});
  assert.equal((await api(`/api/session/${rejected}`)).data.outcome,'failed','priority rejection must remain an execution error');
  const rejectedPrimary=inference.slice(beforeRejection).filter(body=>body.tools?.some(tool=>tool.function?.name==='router_probe'));
  assert.equal(rejectedPrimary.length,1,'400 must not trigger primary retries or downgrade');
  assert.equal(inference.at(-1).service_tier,'priority');
  console.log(JSON.stringify({ threeTiers:true, currentRequestRouted:true, fallback:true, queuePreserved:true, autoFast:true, fastToolSteps:true, modeSwitch:true, priorityRejection:true, evidence:root }));
} finally {
  writeFileSync(join(root,'host.log'),logs);
  writeFileSync(join(root,'inference.json'),JSON.stringify(inference,null,2));
  console.error(`Host fixture evidence: ${root}`);
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(3000)]);
  if(child.exitCode===null) child.kill('SIGKILL');
  mock.closeAllConnections(); await new Promise(resolve=>mock.close(resolve));
}
