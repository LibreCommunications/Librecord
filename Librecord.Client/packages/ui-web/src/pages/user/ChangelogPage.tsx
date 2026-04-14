import Markdown from "react-markdown";
import changelog from "../../../../../changelog.md?raw";

export default function ChangelogPage() {
    return (
        <div className="max-w-3xl mx-auto">
            <div className="prose prose-invert prose-sm max-w-none
                prose-headings:text-white
                prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-6
                prose-h2:text-lg prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-[#dbdee1]
                prose-h3:text-sm prose-h3:font-bold prose-h3:uppercase prose-h3:tracking-wide prose-h3:text-[#b5bac1] prose-h3:mt-4 prose-h3:mb-2
                prose-p:text-[#dbdee1] prose-p:text-sm prose-p:leading-relaxed
                prose-li:text-[#dbdee1] prose-li:text-sm
                prose-strong:text-white
                prose-hr:border-[#3f4147] prose-hr:my-6
                prose-ul:my-1
                prose-a:text-[#00a8fc] hover:prose-a:underline
                prose-code:text-[#57f287] prose-code:bg-[#1e1f22] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
            ">
                <Markdown>{changelog}</Markdown>
            </div>
        </div>
    );
}
