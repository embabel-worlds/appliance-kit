export type SourceKind = 
/** An http(s) page — openable by anyone, on either surface. */
'web'
/** A file the appliance reads from a shared folder. Openable only where the mount table lives. */
 | 'file'
/** A URI this package will not guess about: the appliance's own volume, an unknown scheme. */
 | 'opaque';
export interface CitedSource {
    kind: SourceKind;
    /** What to show. Never the raw URI when something shorter is truthful. */
    label: string;
    /** Present for `web`: where to send the reader. */
    url?: string;
    /** Present for `file`: the path AS THE APPLIANCE SEES IT, which is not a host path. */
    containerPath?: string;
}
/**
 * Classify a citation's URI.
 *
 * The `web` label is host + path rather than the whole URL: a query string is usually tracking
 * parameters and always the widest part of the line, and the link carries the real destination.
 */
export declare function classifySource(uri: string | null | undefined): CitedSource;
//# sourceMappingURL=citations.d.ts.map