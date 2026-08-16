/*
 * READING AN SSE STREAM, incrementally.
 *
 * WHY NOT `EventSource`. It cannot set request headers. Both front ends authenticate the appliance
 * with HTTP Basic they hold themselves — the console in sessionStorage, the Me app's main process
 * in its settings — rather than with an ambient cookie, so an `EventSource` request goes out
 * unauthenticated and the appliance answers 401. Worse, it fails SILENTLY: the browser reports a
 * bare `error` event with no status, so a progress panel simply stays empty and looks like a
 * feature that does not work. `fetch` can carry the header, and its body can be read as it
 * arrives; that is the only reason this parser exists.
 *
 * HAND-ROLLED ON PURPOSE, which is normally the wrong answer. `text/event-stream` is a genuinely
 * tiny and frozen format — blocks separated by a blank line, `field: value` lines within — and the
 * Me app has parsed it this way in `chat.ts` for a while. This is that parse, lifted so the two
 * front ends share one, and so it can be tested without a browser or a server.
 *
 * Pure: no fetch, no DOM, no timers. Feed it text, take events out.
 */
export function createSseParser() {
    let buffer = '';
    return {
        push(text) {
            // Normalise line endings first: the spec allows CRLF, and a stray \r left on a field value
            // turns `data: {...}\r` into JSON that will not parse.
            buffer += text.replace(/\r\n?/g, '\n');
            const events = [];
            let cut;
            while ((cut = buffer.indexOf('\n\n')) >= 0) {
                const block = buffer.slice(0, cut);
                buffer = buffer.slice(cut + 2);
                let event = 'message';
                let id;
                const data = [];
                for (const line of block.split('\n')) {
                    // A line beginning with a colon is a comment — servers send them as keep-alives.
                    if (line.startsWith(':') || line === '')
                        continue;
                    const colon = line.indexOf(':');
                    const field = colon === -1 ? line : line.slice(0, colon);
                    // Exactly one leading space after the colon is part of the delimiter, not the value.
                    let value = colon === -1 ? '' : line.slice(colon + 1);
                    if (value.startsWith(' '))
                        value = value.slice(1);
                    if (field === 'event')
                        event = value;
                    else if (field === 'data')
                        data.push(value);
                    else if (field === 'id')
                        id = value;
                }
                // A block with no `data:` at all is a comment or a bare keep-alive; it is not an event.
                if (data.length === 0)
                    continue;
                events.push(id === undefined ? { event, data: data.join('\n') } : { event, data: data.join('\n'), id });
            }
            return events;
        },
    };
}
//# sourceMappingURL=sse.js.map