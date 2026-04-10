/**
 * E2E test runner for Omnilingo via MCP Bridge WebSocket.
 *
 * Protocol: { id, command, args } → { id, success, data, error }
 *
 * Usage:
 *   1. In one terminal: cargo tauri dev --features mcp
 *   2. In another:      bun e2e/run.ts
 *
 * The MCP bridge listens on ws://127.0.0.1:9223 by default.
 */
import WebSocket from "ws";

const WS_URL = process.env.OMNILINGO_E2E_WS ?? "ws://127.0.0.1:9223";
const READY_TIMEOUT_MS = Number(process.env.OMNILINGO_E2E_READY_TIMEOUT ?? 60_000);

let ws: WebSocket;
let msgId = 0;
const pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
let passed = 0;
let failed = 0;
const failures: string[] = [];

// ── Bridge primitives ───────────────────────────────────────────

function send(command: string, args: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = String(++msgId);
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, command, args }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout waiting for ${command}`));
      }
    }, timeoutMs);
  });
}

async function execJs(script: string): Promise<string> {
  const result = await send("execute_js", { script });
  return String(result.data ?? "");
}

async function getPageText(): Promise<string> {
  return execJs("(() => document.body.innerText.substring(0, 4000))()");
}

async function clickCss(selector: string): Promise<string> {
  const r = await execJs(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return 'not-found';
    el.click();
    return 'ok';
  })()`);
  await sleep(500);
  return r;
}

async function clickText(text: string): Promise<string> {
  const r = await execJs(`(() => {
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const target = ${JSON.stringify(text)};
    const all = document.querySelectorAll('button, a, [role=button], label');
    for (const el of all) {
      if (norm(el.textContent) === target) { el.click(); return 'exact'; }
    }
    for (const el of all) {
      if ((el.textContent || '').includes(target)) { el.click(); return 'partial'; }
    }
    return 'not-found';
  })()`);
  await sleep(500);
  return r;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Assertions ──────────────────────────────────────────────────

async function assert(name: string, fn: () => Promise<boolean>): Promise<void> {
  try {
    const ok = await fn();
    if (ok) {
      passed++;
      console.log(`  ✓ ${name}`);
    } else {
      failed++;
      failures.push(name);
      console.log(`  ✗ ${name}`);
    }
  } catch (e: any) {
    failed++;
    failures.push(`${name}: ${e?.message ?? e}`);
    console.log(`  ✗ ${name}: ${e?.message ?? e}`);
  }
}

async function assertText(name: string, expected: string): Promise<void> {
  await assert(name, async () => {
    const text = await getPageText();
    return text.includes(expected);
  });
}

// ── Scenarios ───────────────────────────────────────────────────

async function testBootRedirect(): Promise<void> {
  console.log("\n━━━ 1. Boot & default route ━━━");

  // The root path should redirect to /dictionary on first paint.
  await assert("Hash route is /dictionary after boot", async () => {
    const r = await execJs("(() => location.hash)()");
    return r === "#/dictionary" || r === "#/" || r.startsWith("#/dictionary");
  });

  // Wait for the dictionary view to render its title
  for (let i = 0; i < 10; i++) {
    const text = await getPageText();
    if (text.includes("Dictionary")) break;
    await sleep(500);
  }
  await assertText("Dictionary heading visible", "Dictionary");
}

async function testSidebarNavigation(): Promise<void> {
  console.log("\n━━━ 2. Sidebar navigation ━━━");

  // Every nav link should resolve to a renderable view.
  const pages: Array<{ href: string; title: string }> = [
    { href: "#/dictionary", title: "Dictionary" },
    { href: "#/grammar", title: "Grammar" },
    { href: "#/conjugation", title: "Conjugation" },
    { href: "#/conversation", title: "Conversation" },
    { href: "#/rephrase", title: "Rephrase" },
    { href: "#/corrector", title: "Corrector" },
    { href: "#/synonyms", title: "Synonyms" },
    { href: "#/text-analysis", title: "Text Analysis" },
    { href: "#/settings", title: "Settings" },
  ];

  for (const page of pages) {
    const r = await clickCss(`a[href="${page.href}"]`);
    await assert(`Click sidebar link ${page.href}`, async () => r === "ok");
    await sleep(400);
    await assertText(`${page.href} renders ${page.title}`, page.title);
  }
}

async function testSettings(): Promise<void> {
  console.log("\n━━━ 3. Settings page ━━━");

  await clickCss('a[href="#/settings"]');
  await sleep(600);

  await assertText("Settings title", "Settings");
  await assertText("Language section heading", "Language");
  await assertText("AI section heading", "Artificial Intelligence");
  await assertText("Appearance section heading", "Appearance");
  await assertText("Data section heading", "Data");
}

async function testThemeToggle(): Promise<void> {
  console.log("\n━━━ 4. Dark / light theme toggle ━━━");

  await clickCss('a[href="#/settings"]');
  await sleep(400);

  // Click the "Dark" theme button (text label is the i18n value "Dark")
  await clickText("Dark");
  await sleep(400);
  await assert("Dark mode applied to <html>", async () => {
    const r = await execJs("(() => document.documentElement.classList.contains('dark'))()");
    return r === "true";
  });

  await clickText("Light");
  await sleep(400);
  await assert("Light mode removes dark class", async () => {
    const r = await execJs("(() => document.documentElement.classList.contains('dark'))()");
    return r === "false";
  });
}

async function testCommandPalette(): Promise<void> {
  console.log("\n━━━ 5. Command palette ━━━");

  // Cmd+K opens the palette
  await execJs(
    "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true }))",
  );
  await sleep(400);

  await assert("Command palette is open (input focused or visible)", async () => {
    const r = await execJs(`(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
      return inputs.some((i) => {
        const ph = (i.getAttribute('placeholder') || '').toLowerCase();
        return ph.includes('search') || ph.includes('navigate');
      }) ? 'true' : 'false';
    })()`);
    return r === "true";
  });

  // Escape closes it
  await execJs(
    "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))",
  );
  await sleep(300);
}

// ── Main ────────────────────────────────────────────────────────

async function waitForBridge(): Promise<void> {
  const start = Date.now();
  console.log(`Waiting for MCP bridge at ${WS_URL} ...`);

  while (Date.now() - start < READY_TIMEOUT_MS) {
    try {
      ws = new WebSocket(WS_URL);
      await new Promise<void>((resolve, reject) => {
        const onOpen = () => {
          ws.off("error", onError);
          resolve();
        };
        const onError = (err: Error) => {
          ws.off("open", onOpen);
          reject(err);
        };
        ws.once("open", onOpen);
        ws.once("error", onError);
      });
      console.log("Connected to MCP bridge.\n");
      return;
    } catch {
      await sleep(1000);
    }
  }
  throw new Error(`Timed out waiting for MCP bridge after ${READY_TIMEOUT_MS}ms`);
}

async function main(): Promise<void> {
  console.log("🚀 Omnilingo E2E");

  await waitForBridge();

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id)!;
        pending.delete(msg.id);
        if (msg.success === false) {
          reject(new Error(msg.error || "MCP bridge error"));
        } else {
          resolve(msg);
        }
      }
    } catch {
      // ignore non-JSON frames
    }
  });

  // Reset transient localStorage state and reload so each run starts clean.
  await send("execute_js", {
    script:
      "(() => { try { localStorage.removeItem('omnilingo-ui-lang'); } catch {} ; location.hash = '#/dictionary'; return 'reset'; })()",
  });
  await sleep(1500);

  try {
    await testBootRedirect();
    await testSidebarNavigation();
    await testSettings();
    await testThemeToggle();
    await testCommandPalette();
  } catch (e: any) {
    console.error("\n💥 Fatal error during test run:", e?.message ?? e);
    failed++;
    failures.push(`Fatal: ${e?.message ?? e}`);
  }

  console.log("\n════════════════════════════════════════");
  console.log(`  ✓ Passed: ${passed}`);
  console.log(`  ✗ Failed: ${failed}`);
  console.log(`  Total:    ${passed + failed}`);
  if (failures.length > 0) {
    console.log("\n  Failures:");
    failures.forEach((f) => console.log(`    - ${f}`));
  }
  console.log("════════════════════════════════════════\n");

  ws.close();
  process.exit(failed > 0 ? 1 : 0);
}

main();
