/**
 * E2E test runner for Omnilingo via MCP Bridge WebSocket
 * Protocol: { id, command, args } → { id, success, data, error }
 *
 * Usage: bun e2e/run.ts
 * Requires: cargo tauri dev --features mcp
 */
import WebSocket from "ws";

const WS_URL = "ws://localhost:9223";
let ws: WebSocket;
let msgId = 0;
const pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
let passed = 0;
let failed = 0;
const failures: string[] = [];

function send(command: string, args: Record<string, unknown> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = String(++msgId);
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, command, args }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout: ${command}`));
      }
    }, 15000);
  });
}

async function execJs(script: string): Promise<string> {
  const result = await send("execute_js", { script });
  return String(result.data ?? "");
}

async function getPageText(): Promise<string> {
  return execJs("(() => document.body.innerText.substring(0, 3000))()");
}

async function clickText(text: string): Promise<void> {
  await execJs(`(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.textContent?.trim() === ${JSON.stringify(text)}) {
        const el = walker.currentNode.parentElement;
        if (el) { el.click(); return 'clicked'; }
      }
    }
    // Try partial match
    const all = document.querySelectorAll('button, a, [role=button]');
    for (const el of all) {
      if (el.textContent?.includes(${JSON.stringify(text)})) { el.click(); return 'clicked-partial'; }
    }
    return 'not-found';
  })()`);
  await sleep(600);
}

async function clickCss(selector: string): Promise<void> {
  await execJs(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) { el.click(); return 'ok'; } return 'not-found'; })()`);
  await sleep(600);
}

async function fillInput(placeholder: string, value: string): Promise<void> {
  await execJs(`(() => {
    const input = document.querySelector('input[placeholder*="${placeholder}"]') || document.querySelector('textarea[placeholder*="${placeholder}"]');
    if (input) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) nativeInputValueSetter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return 'filled';
    }
    return 'not-found';
  })()`);
  await sleep(300);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function assert(name: string, fn: () => Promise<boolean>) {
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
    failures.push(`${name}: ${e.message}`);
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

async function assertText(name: string, expected: string) {
  await assert(name, async () => {
    const text = await getPageText();
    return text.includes(expected);
  });
}

async function assertNoText(name: string, unexpected: string) {
  await assert(name, async () => {
    const text = await getPageText();
    return !text.includes(unexpected);
  });
}

// ── Scenarios ───────────────────────────────────────────────────

async function testOnboardingComplete() {
  console.log("\n━━━ 1. Onboarding: Complete Flow ━━━");

  await assertText("Step 0: Welcome screen", "Welcome to Omnilingo");
  await assertText("Step 0: Get started button", "Get started");

  await clickText("Get started");
  await assertText("Step 1: Native language question", "What is your native language");

  await clickText("Français");
  await assertText("Step 2: Target language question", "What language do you want to learn");

  await clickText("Deutsch");
  await assertText("Step 3: Level selection", "What is your current level");
  await assertText("Step 3: B2 available", "B2");

  await clickText("B2");
  await assertText("Step 4: AI Provider setup", "AI Provider");
  await assertText("Step 4: Test connection button", "Test connection");
  await assertText("Step 4: Claude Code default", "Claude Code");

  await clickText("Get started");
  await assertText("Step 5: Dictionary download", "Add your dictionary");
  await assert("Step 5: Search input present", async () => {
    const r = await execJs("(() => !!document.querySelector('input[placeholder*=\"Search\"]'))()");
    return r === "true";
  });

  // Dictionaries listed or "no dictionaries" (catalog may not be loaded in dev)
  await sleep(500);
  await assert("Step 5: Dict list or import option visible", async () => {
    const text = await getPageText();
    return text.includes("Download") || text.includes("Import") || text.includes("No dictionaries") || text.includes("import");
  });

  // Skip
  await clickText("Skip for now");
  await sleep(1000);
}

async function testDashboard() {
  console.log("\n━━━ 2. Dashboard ━━━");

  await clickCss('a[href="#/"]');
  await sleep(500);

  await assertText("Streak visible", "Streak");
  await assertText("Cards due visible", "Cards due");
  await assertText("Words learned visible", "Words learned");
  await assertText("Accuracy visible", "Accuracy");
  await assertText("Daily goal visible", "Daily goal");
  await assertText("Quick actions visible", "Quick actions");
  await assertText("Language pair in sidebar", "French");
  await assertText("Language pair in sidebar", "German");
  await assertText("Level B2 in sidebar", "B2");
}

async function testSidebarNavigation() {
  console.log("\n━━━ 3. Sidebar Navigation ━━━");

  const pages = [
    { href: "#/learn", name: "Learn" },
    { href: "#/review", name: "Review" },
    { href: "#/grammar", name: "Grammar" },
    { href: "#/conjugation", name: "Conjugation" },
    { href: "#/dictionary", name: "Dictionary" },
    { href: "#/quiz", name: "Quiz" },
    { href: "#/flashcards", name: "Flashcards" },
    { href: "#/conversation", name: "Conversation" },
    { href: "#/chat", name: "AI Chat" },
    { href: "#/stats", name: "Stats" },
    { href: "#/settings", name: "Settings" },
  ];

  for (const page of pages) {
    await clickCss(`a[href="${page.href}"]`);
    await sleep(500);
    await assert(`Navigate to ${page.name}`, async () => {
      const text = await getPageText();
      return text.length > 50;
    });
  }
}

async function testDictionary() {
  console.log("\n━━━ 4. Dictionary ━━━");

  await clickCss('a[href="#/dictionary"]');
  await sleep(500);
  await assertText("Dictionary title", "Dictionary");
}

async function testChat() {
  console.log("\n━━━ 5. Chat ━━━");

  await clickCss('a[href="#/chat"]');
  await sleep(500);

  await assertText("Chat title", "AI Chat");
  await assertText("Quick actions visible", "Correct");
  await assertText("Empty state", "Hello");
}

async function testConversation() {
  console.log("\n━━━ 6. Conversation ━━━");

  await clickCss('a[href="#/conversation"]');
  await sleep(500);

  await assertText("Conversation visible", "Conversation");
}

async function testSettings() {
  console.log("\n━━━ 7. Settings ━━━");

  await clickCss('a[href="#/settings"]');
  await sleep(800);

  await assertText("Settings title", "Settings");
  await assertText("Language section", "Language");
  await assertText("AI section", "AI");
  await assertText("Appearance section", "Appearance");

  // Theme switching
  await clickText("Dark");
  await sleep(500);
  await assert("Dark mode applied", async () => {
    const r = await execJs("(() => document.documentElement.classList.contains('dark'))()");
    return r === "true";
  });

  await clickText("Light");
  await sleep(500);
  await assert("Light mode applied", async () => {
    const r = await execJs("(() => document.documentElement.classList.contains('dark'))()");
    return r === "false";
  });

  await clickText("System");
  await sleep(300);
}

async function testCommandPalette() {
  console.log("\n━━━ 8. Command Palette ━━━");

  await execJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))");
  await sleep(500);

  await assert("Command palette opens (Cmd+K)", async () => {
    const text = await getPageText();
    return text.includes("ESC");
  });

  await execJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
  await sleep(300);
}

async function testLanguagePairDisplay() {
  console.log("\n━━━ 9. Language Pair Display ━━━");

  await clickCss('a[href="#/"]');
  await sleep(500);

  await assert("Pair shows native → target order", async () => {
    // Read the selected option text from the sidebar select
    const optionText = await execJs("(() => { const sel = document.querySelector('aside select'); if (!sel) return ''; const opt = sel.options[sel.selectedIndex]; return opt ? opt.textContent : ''; })()");
    const frenchIdx = optionText.indexOf("French");
    const germanIdx = optionText.indexOf("German");
    return frenchIdx !== -1 && germanIdx !== -1 && frenchIdx < germanIdx;
  });
}

async function testQuiz() {
  console.log("\n━━━ 10. Quiz ━━━");

  await clickCss('a[href="#/quiz"]');
  await sleep(500);
  await assert("Quiz page loads", async () => {
    const text = await getPageText();
    return text.length > 50;
  });
}

async function testFlashcards() {
  console.log("\n━━━ 11. Flashcards ━━━");

  await clickCss('a[href="#/flashcards"]');
  await sleep(500);
  await assertText("Flashcards page loads", "Flashcards");
}

async function testGrammar() {
  console.log("\n━━━ 12. Grammar ━━━");

  await clickCss('a[href="#/grammar"]');
  await sleep(500);
  await assert("Grammar page loads", async () => {
    const text = await getPageText();
    return text.length > 50;
  });
}

async function testConjugation() {
  console.log("\n━━━ 13. Conjugation ━━━");

  await clickCss('a[href="#/conjugation"]');
  await sleep(500);
  await assert("Conjugation page loads", async () => {
    const text = await getPageText();
    return text.length > 50;
  });
}

async function testStats() {
  console.log("\n━━━ 14. Stats ━━━");

  await clickCss('a[href="#/stats"]');
  await sleep(500);
  await assert("Stats page loads", async () => {
    const text = await getPageText();
    return text.length > 50;
  });
}

async function testLearn() {
  console.log("\n━━━ 15. Learn ━━━");

  await clickCss('a[href="#/learn"]');
  await sleep(500);
  await assert("Learn page loads", async () => {
    const text = await getPageText();
    return text.length > 50;
  });
}

async function testReview() {
  console.log("\n━━━ 16. Review ━━━");

  await clickCss('a[href="#/review"]');
  await sleep(500);
  await assert("Review page loads", async () => {
    const text = await getPageText();
    return text.length > 50;
  });
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Omnilingo E2E Tests");
  console.log(`Connecting to ${WS_URL}...\n`);

  ws = new WebSocket(WS_URL);

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id)!;
        pending.delete(msg.id);
        if (msg.success === false) {
          reject(new Error(msg.error || "Unknown error"));
        } else {
          resolve(msg);
        }
      }
    } catch {}
  });

  await new Promise<void>((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });

  console.log("Connected to MCP Bridge!\n");

  // Reset onboarding state and reload
  await send("execute_js", { script: "(() => { localStorage.removeItem('omnilingo-onboarding-done'); localStorage.removeItem('omnilingo-chat'); localStorage.removeItem('omnilingo-ui-lang'); location.reload(); return 'reset'; })()" });
  await sleep(3000);

  try {
    await testOnboardingComplete();
    await testDashboard();
    await testLanguagePairDisplay();
    await testSidebarNavigation();
    await testDictionary();
    await testLearn();
    await testReview();
    await testGrammar();
    await testConjugation();
    await testQuiz();
    await testFlashcards();
    await testChat();
    await testConversation();
    await testStats();
    await testSettings();
    await testCommandPalette();
  } catch (e: any) {
    console.error("\n💥 Fatal error:", e.message);
  }

  console.log("\n════════════════════════════════════════");
  console.log(`  ✓ Passed: ${passed}`);
  console.log(`  ✗ Failed: ${failed}`);
  console.log(`  Total:   ${passed + failed}`);
  if (failures.length > 0) {
    console.log("\n  Failures:");
    failures.forEach((f) => console.log(`    - ${f}`));
  }
  console.log("════════════════════════════════════════\n");

  ws.close();
  process.exit(failed > 0 ? 1 : 0);
}

main();
