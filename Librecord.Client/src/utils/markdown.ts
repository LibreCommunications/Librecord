export function renderMarkdown(text: string): string {
    let html = escapeHtml(text);

    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
        return `<pre class="bg-[#1e1f22] rounded p-2 my-1 text-sm overflow-x-auto"><code>${code.trim()}</code></pre>`;
    });

    html = html.replace(/`([^`\n]+)`/g, '<code class="bg-[#1e1f22] rounded px-1 py-0.5 text-sm">$1</code>');

    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-3 border-gray-500 pl-2 text-gray-300">$1</blockquote>');

    // Links (auto-detect URLs — only http/https, no javascript: or data:)
    html = html.replace(
        /(https?:\/\/[^\s<"']+)/g,
        (url) => {
            try {
                const parsed = new URL(url);
                if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return url;
                return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-[#5865F2] hover:underline">${url}</a>`;
            } catch {
                return url;
            }
        }
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
