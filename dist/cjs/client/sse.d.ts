export interface SseEvent {
    /** The `event:` name, or `message` when the frame did not name one — the spec's default. */
    event: string;
    /** The joined `data:` lines, unparsed. Multi-line data is joined with newlines, per the spec. */
    data: string;
    /** The `id:` field, when the stream sent one. */
    id?: string;
}
export interface SseParser {
    /**
     * Feed the next chunk of decoded text. Returns whatever COMPLETE events it now holds — a chunk
     * that ends mid-frame yields nothing and the remainder is buffered for the next call.
     */
    push(text: string): SseEvent[];
}
export declare function createSseParser(): SseParser;
//# sourceMappingURL=sse.d.ts.map