import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { configDirectory } from "../../lib/config.js";
import { Board } from "./model.js";
const missing = (error) => error.code === "ENOENT";
/**
 * @spec Each harness/session has one Board across cwd, repo and branch changes.
 * @spec Updates and consumes reload under a process-shared lock and commit by atomic rename.
 * @why A failed read/write is not an empty Board or a successful consume.
 * @see {@link component://docs/board.md}
 */
export class BoardStore {
    session;
    directory;
    path;
    constructor(session, directory = join(configDirectory(), "board", "sessions")) {
        this.session = session;
        if (!session.sessionId)
            throw new Error("Board requires a session ID");
        this.directory = directory;
        this.path = join(directory, createHash("sha256").update(JSON.stringify([session.harness, session.sessionId])).digest("hex") + ".json");
    }
    async locked(operation, run) {
        try {
            await mkdir(this.directory, { recursive: true, mode: 0o700 });
            // Native locks are released on process death. Never unlink the lock inode while waiters can exist.
            const { flockSync } = createRequire(import.meta.url)("fs-ext");
            const file = await open(this.path + ".lock", "a+", 0o600);
            let owned = false;
            try {
                const signal = AbortSignal.timeout(2_000);
                for (;;) {
                    signal.throwIfAborted();
                    try {
                        flockSync(file.fd, "exnb");
                        owned = true;
                        break;
                    }
                    catch (error) {
                        if (!["EAGAIN", "EWOULDBLOCK"].includes(error.code ?? ""))
                            throw error;
                    }
                    await delay(10, undefined, { signal });
                }
                return await run();
            }
            finally {
                try {
                    if (owned)
                        flockSync(file.fd, "un");
                }
                finally {
                    await file.close();
                }
            }
        }
        catch (error) {
            console.error(JSON.stringify({ plugin: "devloop", event: "board_storage_failed", operation, harness: this.session.harness,
                session_id: this.session.sessionId, error: error instanceof Error ? error.message : String(error) }));
            throw error;
        }
    }
    async transaction(operation, run) {
        return this.locked(operation, async () => {
            let board;
            try {
                board = Board.restore(JSON.parse(await readFile(this.path, "utf8")));
            }
            catch (error) {
                if (!missing(error))
                    throw error;
                board = new Board();
            }
            const result = await run(board);
            const content = JSON.stringify(board.snapshot());
            const temporary = `${this.path}.${randomUUID()}.tmp`;
            try {
                const file = await open(temporary, "wx", 0o600);
                try {
                    await file.writeFile(content);
                    await file.sync();
                }
                finally {
                    await file.close();
                }
                await rename(temporary, this.path);
            }
            finally {
                await rm(temporary, { force: true });
            }
            return result;
        });
    }
    async clear() {
        await this.locked("clear", () => rm(this.path, { force: true }));
    }
}
//# sourceMappingURL=store.js.map