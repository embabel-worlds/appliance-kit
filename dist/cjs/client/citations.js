"use strict";
/*
 * WHERE A CITED DOCUMENT CAME FROM — the part both front ends can answer.
 *
 * A citation is only worth printing if the reader can check it, and checking means knowing what
 * kind of thing the URI names. That classification is identical on both sides: a web page is a web
 * page, a `file://` under the appliance's mount root is a shared local file, anything else is
 * something we should not pretend to understand.
 *
 * WHAT IS NOT HERE, DELIBERATELY. Me can go one step further and walk a container path back to the
 * real file on the Mac, because Me is the half that WROTE the mounts — `<host folder>:/local/<name>`
 * in `docker-compose.override.yml` — so it alone holds the mapping. It then offers "reveal in
 * Finder", and a citation you can open is verification rather than decoration.
 *
 * The Worlds console cannot do that and must not appear to. It is a browser, on a machine that may
 * not be the appliance's host at all, with no mount table and no way to open a file even if it had
 * one. So the console shows the same classification and the same label and stops there. That is the
 * honest line, and it is drawn here rather than in either UI so neither drifts across it: this
 * module classifies, and a caller that can resolve further does so on top.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifySource = classifySource;
/**
 * Classify a citation's URI.
 *
 * The `web` label is host + path rather than the whole URL: a query string is usually tracking
 * parameters and always the widest part of the line, and the link carries the real destination.
 */
function classifySource(uri) {
    if (!uri)
        return { kind: 'opaque', label: 'unknown source' };
    if (/^https?:\/\//i.test(uri)) {
        let label = uri;
        try {
            const parsed = new URL(uri);
            label = parsed.hostname + parsed.pathname;
        }
        catch {
            /* an http-ish string that will not parse — show it as it came */
        }
        return { kind: 'web', label, url: uri };
    }
    if (uri.startsWith('file://')) {
        let containerPath;
        try {
            containerPath = decodeURIComponent(new URL(uri).pathname);
        }
        catch {
            containerPath = uri.replace(/^file:\/\//, '');
        }
        return { kind: 'file', label: containerPath, containerPath };
    }
    return { kind: 'opaque', label: uri };
}
//# sourceMappingURL=citations.js.map