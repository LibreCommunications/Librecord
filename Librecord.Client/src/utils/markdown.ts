/**
 * Simple markdown renderer for message content.
 * Supports: bold, italic, strikethrough, code blocks, inline code, links, quotes.
 * Returns sanitized HTML.
 */
export function renderMarkdown(text: string): string {
    let html = escapeHtml(text);

    // Code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
        return `<pre class="bg-[#1e1f22] rounded p-2 my-1 text-sm overflow-x-auto"><code>${code.trim()}</code></pre>`;
    });

    // Inline code (`...`)
    html = html.replace(/`([^`\n]+)`/g, '<code class="bg-[#1e1f22] rounded px-1 py-0.5 text-sm">$1</code>');

    // Bold (**...**)
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // Italic (*...*)
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Strikethrough (~~...~~)
    html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");

    // Block quotes (> ...)
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-3 border-gray-500 pl-2 text-gray-300">$1</blockquote>');

    // Links (auto-detect URLs)
    html = html.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-[#5865F2] hover:underline">$1</a>'
    );

    return html;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
