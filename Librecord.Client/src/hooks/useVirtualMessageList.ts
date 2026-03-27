import { useLayoutEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Message } from "../types/message";

type OptimisticMessage = Message & { clientMessageId?: string };

export type FlatItem =
    | { type: "separator"; key: string; date: string }
    | { type: "message"; key: string; msg: OptimisticMessage };

function buildFlatItems(messages: OptimisticMessage[]): FlatItem[] {
    const items: FlatItem[] = [];
    let prevDate: string | null = null;

    for (const msg of messages) {
        const msgDate = new Date(msg.createdAt).toDateString();
        if (msgDate !== prevDate) {
            items.push({ type: "separator", key: `sep-${msgDate}`, date: msg.createdAt });
            prevDate = msgDate;
        }
        items.push({ type: "message", key: msg.id, msg });
    }

    return items;
}

export function useVirtualMessageList(
    messages: OptimisticMessage[],
    containerRef: React.RefObject<HTMLDivElement | null>,
) {
    const flatItems = useMemo(() => buildFlatItems(messages), [messages]);

    const prevFirstIdRef = useRef<string | null>(null);
    const prevFlatLenRef = useRef(0);

    const virtualizer = useVirtualizer({
        count: flatItems.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => 72,
        overscan: 10,
    });

    // Prepend scroll restoration: when older messages are loaded at the top,
    // keep the previously-first-visible message in the same scroll position.
    useLayoutEffect(() => {
        const firstMsg = messages[0];
        const firstId = firstMsg?.id ?? null;
        const prevFirstId = prevFirstIdRef.current;
        const prevFlatLen = prevFlatLenRef.current;

        prevFirstIdRef.current = firstId;
        prevFlatLenRef.current = flatItems.length;

        // Detect prepend: first message ID changed AND total items grew
        if (
            prevFirstId !== null &&
            firstId !== null &&
            prevFirstId !== firstId &&
            flatItems.length > prevFlatLen
        ) {
            // Find where the old first message now sits in the flat list
            const oldIndex = flatItems.findIndex(
                item => item.type === "message" && item.key === prevFirstId
            );
            if (oldIndex > 0) {
                virtualizer.scrollToIndex(oldIndex, { align: "start" });
            }
        }
    }, [flatItems, messages, virtualizer]);

    return { virtualizer, flatItems };
}
