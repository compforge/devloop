import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardStore } from "../domain/board/store.js";

const roots: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const root of roots.splice(0)) rmSync(root,{recursive:true,force:true}); });
function fixture(sessionId = "same/session", harness = "codex") {
  const root = mkdtempSync(join(tmpdir(),"devloop-board-store-")); roots.push(root);
  return new BoardStore({harness, sessionId}, root);
}
function child(source: string): Promise<string> {
  return new Promise((resolve,reject) => {
    const process = spawn(globalThis.process.execPath,["--input-type=module","-e",source],{stdio:["ignore","pipe","pipe"]});
    let output = "", error = "";
    process.stdout.on("data",chunk => {output += chunk;});
    process.stderr.on("data",chunk => {error += chunk;});
    process.on("error",reject);
    process.on("close",code => code === 0 ? resolve(output) : reject(new Error(error || `child exited ${code}`)));
  });
}
function worker(store: BoardStore): string {
  return `import { BoardStore } from ${JSON.stringify(new URL("../dist/domain/board/store.js",import.meta.url).href)};
const store = new BoardStore(${JSON.stringify(store.session)},${JSON.stringify(store.directory)});`;
}

describe("persistent Board", () => {
  it("reloads both full text and pending queues, then durably consumes them", async () => {
    const store = fixture();
    await store.transaction("upsert",board => {
      board.upsert({id:"x",scope:"repo",content:"one"});
      board.upsert({id:"x",scope:"repo",content:"two"});
    });
    const next = new BoardStore(store.session,store.directory);
    expect(await next.transaction("full",board => board.text())).toBe("two");
    expect(await next.transaction("delta",board => board.delta())).toBe("one\n\ntwo");
    expect(await store.transaction("delta",board => board.delta())).toBe("");
    expect(JSON.parse(readFileSync(store.path,"utf8")).notes.x).toEqual({scope:"repo",full:"two",queue:[]});
    await store.clear(); await store.clear();
    expect(await next.transaction("full",board => board.text())).toBe("");
  });
  it("isolates harness identities and does not collide sanitized session IDs", async () => {
    const a = fixture("a/b","codex");
    const b = new BoardStore({sessionId:"a/b",harness:"claude"},a.directory);
    const c = new BoardStore({sessionId:"a-b",harness:"codex"},a.directory);
    await a.transaction("upsert",board => board.upsert({id:"x",scope:"workspace",content:"private"}));
    expect(await b.transaction("full",board => board.text())).toBe("");
    expect(await c.transaction("full",board => board.text())).toBe("");
  });
  it("preserves the committed queue when serialization fails", async () => {
    vi.spyOn(console,"error").mockImplementation(() => {});
    const store = fixture();
    await store.transaction("upsert",board => board.upsert({id:"x",scope:"repo",content:"pending"}));
    await expect(store.transaction("delta",board => {
      board.delta();
      let calls = 0;
      const bad = {merge:() => bad,text:() => {if (++calls > 1) throw new Error("cannot persist"); return "bad";}};
      board.upsert({id:"bad",scope:"repo",content:bad});
    })).rejects.toThrow("cannot persist");
    expect(await store.transaction("delta",board => board.delta())).toBe("pending");
  });
  it("does not overwrite a corrupt snapshot as an empty Board", async () => {
    vi.spyOn(console,"error").mockImplementation(() => {});
    const store = fixture(); writeFileSync(store.path,"broken");
    await expect(store.transaction("delta",board => board.delta())).rejects.toThrow();
    expect(readFileSync(store.path,"utf8")).toBe("broken");
  });
  // @case Separate hook processes serialize read/merge/write and concurrent delta consumers never duplicate an update.
  it("preserves concurrent process updates and consumes each only once", async () => {
    const store = fixture();
    await Promise.all(Array.from({length:4},(_,i) => child(worker(store) + `
await store.transaction('upsert', async board => {
  await new Promise(resolve => setTimeout(resolve,25));
  const value = ${JSON.stringify(`update-${i}`)};
  const content = {text:() => value, merge:previous => ({text:() => String(previous) + '\\n' + value, merge:() => {throw new Error('unused');}})};
  board.upsert({id:'shared',scope:'branch',content});
});`)));
    const results = await Promise.all(Array.from({length:2},() => child(worker(store) + `process.stdout.write(JSON.stringify(await store.transaction('delta',board => board.delta())));`)));
    const deltas = results.map(result => JSON.parse(result) as string);
    expect(deltas.filter(Boolean)).toHaveLength(1);
    for (let i=0;i<4;i++) expect(deltas.join("").split(`update-${i}`)).toHaveLength(2);
    const full = await store.transaction("full",board => board.text());
    for (let i=0;i<4;i++) expect(full).toContain(`update-${i}`);
  },15_000);
  it("releases the native lock when a hook process crashes", async () => {
    const store = fixture();
    const source = worker(store) + `await store.transaction('crash',async () => {process.exit(23);});`;
    await expect(child(source)).rejects.toThrow("23");
    await store.transaction("after-crash",board => board.upsert({id:"x",scope:"repo",content:"recovered"}));
    expect(await store.transaction("delta",board => board.delta())).toBe("recovered");
  });
});
