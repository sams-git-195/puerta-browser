// REPL driver for Puerta Browser on headless-ish Linux.
// Launches the dev build (out/) against an ISOLATED copy of the user's data
// dir, so automated runs never touch ~/.config/Puerta. Designed for agents:
// wrap in tmux, send-keys commands, capture-pane output. See SKILL.md.
import { _electron as electron } from "playwright-core";
import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const SKILL_DIR = import.meta.dirname;
const APP_DIR = path.resolve(SKILL_DIR, "../../..");
const DATA_DIR = path.join(SKILL_DIR, ".data");
const XDG_DIR = path.join(DATA_DIR, "xdg");
const SHOT_DIR = path.join(SKILL_DIR, "shots");
fs.mkdirSync(SHOT_DIR, { recursive: true });

let app = null;
let mainUI = null;

const findPage = (substr) => app?.windows().find((w) => w.url().includes(substr) && !w.isClosed()) ?? null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Seeds .data/xdg/Puerta from the real ~/.config/Puerta (datastore + DB,
 * INCLUDING the SQLite -wal/-shm files — without them recent rows are lost).
 * Skips if a seeded copy already exists; `reset-data` forces a fresh one.
 */
function seedDataDir(force = false) {
  const target = path.join(XDG_DIR, "Puerta");
  if (fs.existsSync(target) && !force) return;
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });

  const source = path.join(os.homedir(), ".config", "Puerta");
  if (!fs.existsSync(source)) {
    console.log("note: no ~/.config/Puerta — starting with a blank profile (onboarding will show)");
    return;
  }
  fs.cpSync(path.join(source, "datastore"), path.join(target, "datastore"), { recursive: true });
  for (const f of ["flow.db", "flow.db-wal", "flow.db-shm"]) {
    const p = path.join(source, f);
    if (fs.existsSync(p)) fs.copyFileSync(p, path.join(target, f));
  }
  console.log("seeded isolated data dir from ~/.config/Puerta");
}

const COMMANDS = {
  async launch() {
    if (app) return console.log("already launched");
    seedDataDir();
    app = await electron.launch({
      executablePath: path.join(APP_DIR, "node_modules/electron/dist/electron"),
      // --no-sandbox + --no-zygote: on this kernel the sandboxed zygote
      // crashes (zygote_host_impl_linux CHECK), and --no-sandbox alone kills
      // the GPU process (error_code=1002). The pair is the working combo.
      args: ["--no-sandbox", "--no-zygote", APP_DIR],
      cwd: APP_DIR, // migrations resolve relative to the app dir
      env: { ...process.env, XDG_CONFIG_HOME: XDG_DIR },
      timeout: 60_000
    });
    // Suppress the blocking "A JavaScript error occurred" dialog — with no
    // uncaughtException listener, Electron shows a modal the user must close.
    await app.evaluate(() => {
      process.on("uncaughtException", (e) => console.error("[driver] uncaught:", e));
    });
    for (let i = 0; i < 120 && !mainUI; i++) {
      mainUI = findPage("main-ui");
      if (!mainUI) await sleep(500);
    }
    console.log("launched.", app.windows().length, "windows:");
    for (const w of app.windows()) console.log(" ", w.url());
    console.log("main-ui page:", mainUI ? "FOUND" : "NOT FOUND");
  },

  "reset-data"() {
    if (app) return console.log("quit first, then reset-data");
    seedDataDir(true);
  },

  async windows() {
    if (!app) return console.log("ERROR: launch first");
    for (const w of app.windows()) console.log(w.isClosed() ? "(closed)" : "        ", w.url());
  },

  // Evaluate JS in the main browser-UI renderer (the `flow` API lives here)
  async eval(expr) {
    if (!mainUI) return console.log("ERROR: launch first");
    try {
      console.log(JSON.stringify(await mainUI.evaluate(expr), null, 1));
    } catch (e) {
      console.log("ERROR:", e.message);
    }
  },

  // Evaluate in the page whose URL contains the first token
  async evalin(args) {
    const idx = args.indexOf(" ");
    const p = findPage(args.slice(0, idx));
    if (!p) return console.log("NOT_FOUND");
    try {
      console.log(JSON.stringify(await p.evaluate(args.slice(idx + 1)), null, 1));
    } catch (e) {
      console.log("ERROR:", e.message);
    }
  },

  // Tab/group state via the flow API — the ground truth for assertions
  async data() {
    return COMMANDS.eval("flow.tabs.getData()");
  },

  // Screenshot ONE webContents (views don't composite — see SKILL.md)
  async "ss-page"(args) {
    if (!app) return console.log("ERROR: launch first");
    const [substr, name] = args.split(/\s+/);
    const p = findPage(substr);
    if (!p) return console.log("NOT_FOUND:", substr);
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + ".png");
    await p.screenshot({ path: f });
    console.log("screenshot:", f);
  },

  // Send a key through the REAL browser input pipeline. CDP injection
  // (playwright's keyboard.press) bypasses Electron's before-input-event,
  // so app-level shortcuts (e.g. Esc closing a glance) never fire with it.
  async key(args) {
    if (!app) return console.log("ERROR: launch first");
    const [substr, keyCode] = args.split(/\s+/);
    const sent = await app.evaluate(
      ({ webContents }, { substr, keyCode }) => {
        const wc = webContents.getAllWebContents().find((w) => w.getURL().includes(substr));
        if (!wc) return false;
        wc.sendInputEvent({ type: "keyDown", keyCode });
        wc.sendInputEvent({ type: "keyUp", keyCode });
        return true;
      },
      { substr, keyCode }
    );
    console.log(sent ? `sent ${keyCode}` : "NOT_FOUND: " + substr);
  },

  async quit() {
    if (app) await app.close().catch(() => {});
    app = null;
    mainUI = null;
  },
  help() {
    console.log("commands:", Object.keys(COMMANDS).join(", "));
  }
};

// Keep stdin ours — Electron child processes can otherwise steal it.
const stdin = fs.createReadStream(null, { fd: fs.openSync("/dev/stdin", "r") });
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: "driver> " });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return rl.prompt();
  const idx = trimmed.indexOf(" ");
  const cmd = idx === -1 ? trimmed : trimmed.slice(0, idx);
  const rest = idx === -1 ? "" : trimmed.slice(idx + 1);
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.log("unknown:", cmd, "— try: help");
    return rl.prompt();
  }
  try {
    await fn(rest);
  } catch (e) {
    console.log("ERROR:", e.message);
  }
  if (cmd === "quit") {
    rl.close();
    process.exit(0);
  }
  rl.prompt();
});
rl.on("close", async () => {
  await COMMANDS.quit();
  process.exit(0);
});

console.log('puerta driver — "help" for commands, "launch" to start');
rl.prompt();
