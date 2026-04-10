function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

export function formatMessage(text: string): string {
  // 1. Extract code blocks and inline code to protect them from escaping
  const codeBlocks: string[] = [];
  let html = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre class="bg-gray-800 text-gray-100 dark:bg-gray-900 p-3 rounded-lg text-xs font-mono overflow-x-auto my-2"><code>${escapeHtml(code)}</code></pre>`
    );
    return `\x00CB${idx}\x00`;
  });

  const inlineCodes: string[] = [];
  html = html.replace(/`([^`]+)`/g, (_m, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(
      `<code class="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono">${escapeHtml(code)}</code>`
    );
    return `\x00IC${idx}\x00`;
  });

  // 2. Escape HTML in the remaining text
  html = escapeHtml(html);

  // 3. Restore code blocks and inline code
  html = html.replace(/\x00CB(\d+)\x00/g, (_m, idx) => codeBlocks[Number(idx)]);
  html = html.replace(/\x00IC(\d+)\x00/g, (_m, idx) => inlineCodes[Number(idx)]);

  // 4. Apply markdown formatting
  //
  // Headings, bold and list items get explicit dark-mode-aware text colors so
  // the rendered HTML stays readable when dropped into a container that uses
  // `bg-white dark:bg-gray-800` (Dictionary AI panel, Grammar chat assistant
  // bubble, etc.). We can't rely on `prose dark:prose-invert` because the
  // `@tailwindcss/typography` plugin is not installed in this project.
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="font-bold text-base mt-3 mb-1 text-gray-900 dark:text-white">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="font-bold text-lg mt-3 mb-1 text-gray-900 dark:text-white">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="font-bold text-xl mt-3 mb-1 text-gray-900 dark:text-white">$1</h1>');

  // Bold and italic (escaped asterisks: &ast; won't match, but ** will since escapeHtml doesn't touch *)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-700 dark:text-gray-200">$1</li>');
  html = html.replace(/(<li class="ml-4 list-disc text-gray-700 dark:text-gray-200">.*<\/li>\n?)+/g, '<ul class="my-1">$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-700 dark:text-gray-200">$1</li>');

  // Line breaks
  html = html.replace(/\n/g, '<br />');

  return html;
}

/**
 * Render text with **bold** markers as highlighted spans (Reverso-style).
 * Safe: escapes HTML first, then applies highlighting.
 */
export function renderHighlighted(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(
    /\*\*(.+?)\*\*/g,
    '<mark class="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-0.5 rounded font-semibold not-italic">$1</mark>'
  );
  return html;
}

/**
 * Like renderHighlighted but marks are clickable (cursor-pointer + data attribute).
 * Use with event delegation: e.target.closest("[data-clickable-word]")
 */
export function renderClickable(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(
    /\*\*(.+?)\*\*/g,
    '<mark class="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-0.5 rounded font-semibold not-italic cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-800/60 transition-colors" data-clickable-word="$1">$1</mark>'
  );
  return html;
}

/**
 * Parse AI response as JSON. Strips markdown code fences, tries to find JSON object.
 * Returns null if parsing fails (caller should fallback to markdown rendering).
 */
export function parseAiJson<T>(raw: string): T | null {
  let cleaned = raw.trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to extract first JSON object or array from response
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch { /* fallthrough */ }
    }
    return null;
  }
}
