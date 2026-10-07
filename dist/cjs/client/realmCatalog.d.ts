import type { ExecuteOptions, KgBackgroundHandle, KgQueryResult } from './kg.ts';
import { type Outcome } from './outcome.ts';
export type RealmShow = 'all' | 'installed' | 'available';
export interface RealmFilter {
    /** Installed, on offer, or both. Default both. */
    show?: RealmShow;
    /** The category every listed realm is in, as its id. Empty is any. */
    category?: string;
    /** One tag every listed realm carries. Empty is any. */
    tag?: string;
    /** Include realms their authors call experimental. Default false. */
    experimental?: boolean;
    /** Every word must appear in the name, description, author or tags. */
    words?: string;
    /** Judged by meaning — a model reads each row — rather than matched by words. Costs a model call per realm. */
    meaning?: string;
}
/** A `(:Realm)` row, as RealmCatalogBackend states it. */
export interface CatalogRealm {
    name: string;
    description: string;
    installed: boolean;
    /** The installed version, or the offered one for a realm not installed. */
    version: string;
    /** What the directory offers; differs from [version] when an installed realm has moved on. */
    latestVersion: string;
    author: string;
    /** Where it was offered from: the directory source. */
    provider: string;
    /** `experimental`, `beta`, `stable`, `deprecated`, or empty when the author states none. */
    maturity: string;
    /** What the realm is for, as an id from the published list. Empty when it states none the list has. */
    category: string;
    /** The category's name for people. Empty when [category] is. */
    categoryLabel: string;
    /** The category's Phosphor icon name. Empty when it has none. */
    categoryIcon: string;
    tags: string[];
    url: string;
    /** What to install from: the clone URL. Empty for a realm nobody offers (path-installed, private). */
    source: string;
    problems: number;
    missingSources: string[];
}
export interface TagCount {
    tag: string;
    realms: number;
}
/** A category and how many realms are in it. An empty [id] is the realms that state none. */
export interface CategoryCount {
    id: string;
    label: string;
    icon: string;
    realms: number;
}
/** A query and how to run it: the text, and its declared parameters with their values. */
export interface CatalogQuery {
    cypher: string;
    options: ExecuteOptions;
}
type Run = (cypher: string, options: ExecuteOptions) => Promise<Outcome<KgQueryResult | KgBackgroundHandle>>;
/** The realms [filter] lets through: installed first, then by name. */
export declare function realmsQuery(filter: RealmFilter): CatalogQuery;
/** How many realms carry each tag, under every facet but the tag itself. */
export declare function tagsQuery(filter: RealmFilter): CatalogQuery;
/**
 * How many realms are in each category, under every facet but the category itself. The realms that
 * state none come back too, as the row whose category is empty: how many there are is part of the answer.
 */
export declare function categoriesQuery(filter: RealmFilter): CatalogQuery;
/** How many experimental realms the other facets would show if they were included. */
export declare function experimentalQuery(filter: RealmFilter): CatalogQuery;
export declare function toRealm(row: Record<string, unknown>): CatalogRealm;
/** The run parked in the background rather than failing: its answer exists, just not here yet. */
export declare const ranInBackground: (outcome: Outcome<unknown>) => boolean;
export declare class RealmCatalog {
    private readonly run;
    constructor(run: Run);
    realms(filter: RealmFilter): Promise<Outcome<CatalogRealm[]>>;
    tags(filter: RealmFilter): Promise<Outcome<TagCount[]>>;
    categories(filter: RealmFilter): Promise<Outcome<CategoryCount[]>>;
    hiddenExperimental(filter: RealmFilter): Promise<Outcome<number>>;
}
export {};
//# sourceMappingURL=realmCatalog.d.ts.map