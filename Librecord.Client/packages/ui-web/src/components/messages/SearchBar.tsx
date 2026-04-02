import { useState } from "react";
import { useSearch } from "@librecord/app";
import type { SearchResult } from "@librecord/domain";

interface Props {
    channelId?: string;
    guildId?: string;
}

export function SearchBar({ channelId, guildId }: Props) {
    const { search } = useSearch();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSearch() {
        if (!query.trim()) return;
        setLoading(true);
        setOpen(true);
        const r = await search(query.trim(), { channelId, guildId });
        setResults(r);
        setLoading(false);
    }

    return (
        <div className="relative hidden lg:block">
            <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="Search messages..."
                aria-label="Search messages"
                data-testid="search-input"
                className="w-48 px-3 py-1.5 rounded bg-[#1e1f22] text-sm text-white placeholder-gray-500"
            />

            {open && (
                <div role="listbox" data-testid="search-results" className="absolute top-full right-0 mt-1 w-96 max-h-80 overflow-y-auto bg-[#1e1f22] rounded-lg shadow-xl z-50">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
                        <span className="text-xs text-gray-400">
                            {loading ? "Searching..." : `${results.length} results`}
                        </span>
                        <button
                            onClick={() => { setOpen(false); setResults([]); }}
                            className="text-xs text-gray-500 hover:text-white"
                        >
                            Close
                        </button>
                    </div>

                    {results.map(r => (
                        <div key={r.id} role="option" data-testid={`search-result-${r.id}`} className="px-3 py-2 hover:bg-white/5 border-b border-gray-800">
                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                                <span className="font-medium text-gray-300">{r.author.displayName}</span>
                                <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-gray-200 line-clamp-2">{r.content}</p>
                        </div>
                    ))}

                    {!loading && results.length === 0 && (
                        <div className="px-3 py-4 text-sm text-gray-500 text-center">
                            No results found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
