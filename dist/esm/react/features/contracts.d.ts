import type { ReactNode } from 'react';
import type { HandlerGenerated, HandlerMutationResult, HandlerSaveRequest, HandlersClient } from '../../client/handlers.ts';
import type { KgBackgroundHandle, KgClient, KgQueryResult } from '../../client/kg.ts';
import type { Agent, AgentStage, AgentVersion } from '../../client/agents.ts';
import type { Outcome } from '../../client/outcome.ts';
import type { TourSummary } from '../../client/tours.ts';
import type { VcEvent } from '../../vc/events.ts';
import type { SessionBinding } from '../../vc/session.ts';
export interface FeatureState<T> {
    read(): T | null;
    write(value: T | null): void;
}
export interface AppArtifact {
    name: string;
    description?: string | null;
    sizeBytes?: number;
    lastModified?: string | null;
    readOnly?: boolean;
    scope?: string | null;
    url?: string | null;
    iconUrl?: string | null;
}
export interface AppPin {
    key: string;
    name: string;
    scope: string | null;
    url: string;
    missing?: boolean;
    iconUrl?: string | null;
    description?: string | null;
}
export interface PinStore {
    getSnapshot(): AppPin[];
    subscribe(listener: () => void): () => void;
    toggle(pin: AppPin): void;
    reconcile(live: AppPin[]): void;
}
export interface AppsServices {
    listApps(): Promise<Outcome<AppArtifact[]>>;
    searchApps(cypher: string): Promise<Outcome<KgQueryResult | KgBackgroundHandle>>;
}
export interface AppsHost {
    pins: PinStore;
    selectedAppKey(): string | null;
    subscribeSelection(listener: () => void): () => void;
    openApp(app: AppArtifact | null): void;
    openInNewTab(url: string): void;
}
export interface AppsSurfaceProps {
    services: AppsServices;
    host: AppsHost;
}
export interface PinRailProps {
    services: AppsServices;
    host: AppsHost;
}
export interface InstalledRealm {
    name: string;
    version?: string;
    description?: string;
    url?: string;
}
export interface SuggestedRealm {
    name?: string;
    description?: string;
    source?: string;
    repo?: string;
    url?: string;
    repository?: string;
    installed?: boolean;
    provider?: string;
    metadata?: {
        tags?: unknown;
        author?: string;
        version?: string;
        stars?: string;
    };
}
export interface RealmDirectory {
    providers?: Array<{
        provider?: string;
        realms?: SuggestedRealm[];
    }>;
}
export interface RealmInstallResult {
    detail?: string;
    message?: string;
}
export interface RealmUpdates {
    results?: Array<{
        name?: string;
        behind?: boolean | null;
        detail?: string;
    }>;
}
export interface RealmUpdateResult {
    summary?: string;
    message?: string;
}
export interface RealmUpdateAllResult {
    results?: Array<{
        name?: string;
        status?: string;
        summary?: string;
        message?: string;
    }>;
}
export interface RealmServices {
    listInstalled(): Promise<Outcome<InstalledRealm[]>>;
    listDirectory(): Promise<Outcome<RealmDirectory>>;
    refreshDirectory(): Promise<Outcome<void>>;
    installRealm(repo: string): Promise<Outcome<RealmInstallResult>>;
    listUpdates(): Promise<Outcome<RealmUpdates>>;
    updateRealm(name: string): Promise<Outcome<RealmUpdateResult>>;
    updateAll(): Promise<Outcome<RealmUpdateAllResult>>;
    searchRealms(cypher: string): Promise<Outcome<KgQueryResult | KgBackgroundHandle>>;
    listTours(): Promise<Outcome<TourSummary[]>>;
}
export interface RealmsHost {
    openTour(id: string): void;
    confirmUpdateAll(): Promise<boolean>;
    observability?: ReactNode;
}
export interface RealmsSurfaceProps {
    services: RealmServices;
    host: RealmsHost;
}
export interface Watch {
    id: string;
    lensId: string;
    name: string;
    cron: string | null;
    enabled: boolean;
    delivery: {
        channel: string;
    } | null;
}
export interface WatchRun {
    id: string;
    startedAt?: string;
    completedAt?: string | null;
    status?: string;
    diffId?: string | null;
    errorCode?: string | null;
}
export interface WatchChange {
    kind?: string;
    key?: string;
}
export interface WatchDiff {
    id: string;
    targetRunId?: string;
    changes?: WatchChange[];
}
export interface WatchDelivery {
    id: string;
    diffId?: string;
    channel?: string;
    status?: string;
    attempts?: number;
}
export interface CreateWatchRequest {
    lensId: string;
    name: string;
    params: Record<string, string>;
    cron: string;
    delivery: {
        channel: 'signal';
    };
}
export interface WatchServices {
    list(): Promise<Outcome<Watch[]>>;
    create(request: CreateWatchRequest): Promise<Outcome<Watch>>;
    delete(id: string): Promise<Outcome<void>>;
    run(id: string): Promise<Outcome<void>>;
    runs(id: string): Promise<Outcome<WatchRun[]>>;
    changes(id: string): Promise<Outcome<WatchDiff[]>>;
    deliveries(id: string): Promise<Outcome<WatchDelivery[]>>;
}
export interface ViewsServices {
    kg: Pick<KgClient, 'views' | 'runView' | 'viewInvocation' | 'deleteView' | 'refreshView' | 'execute' | 'saveView'> & Partial<Pick<KgClient, 'schema'>>;
    watches: WatchServices;
}
export interface HandlerDraft {
    signalType: string;
    view: string;
}
export type SavedViewsDestination = 'open' | 'run' | 'results' | 'schema' | 'watch';
export interface SavedViewsHost {
    selectedView(): string | null;
    subscribeSelection(listener: () => void): () => void;
    navigateToView?(name: string | null, destination: SavedViewsDestination, replace?: boolean): void;
    onOpenInStudio(cypher: string): void;
    onCreateHandler(draft: HandlerDraft): void;
}
export interface SavedViewsSurfaceProps {
    services: ViewsServices;
    host: SavedViewsHost;
}
export interface SignalType {
    typeName: string;
    fields: string[];
    count: number;
    lastSeen: string;
}
export interface WorldSkill {
    name: string;
    description: string;
}
export interface HandlerStudioServices {
    kg: Pick<KgClient, 'schema'>;
    handlers: Pick<HandlersClient, 'list' | 'open' | 'validate' | 'dryRun' | 'setEnabled' | 'delete'>;
    generateHandler(english: string, current?: string, skills?: string[]): Promise<Outcome<HandlerGenerated>>;
    saveHandler(spec: HandlerSaveRequest): Promise<Outcome<HandlerMutationResult>>;
    gatewayInterfaces(): Promise<Outcome<string>>;
    signalTypes(): Promise<Outcome<SignalType[]>>;
    worldSkills(): Promise<Outcome<WorldSkill[]>>;
    /**
     * The world's agents. Given, and answered, the studio shows each routine at the stage its agent
     * runs it and sends a stage change to the agent instead of offering its own switch. Omitted or
     * unanswered (an appliance older than agents), the studio keeps its own on/off controls.
     */
    listAgents?(): Promise<Outcome<Agent[]>>;
}
export interface HandlerStudioSurfaceProps {
    services: HandlerStudioServices;
    draft?: HandlerDraft | null;
    onDraftConsumed?(): void;
    /**
     * Open a routine by name, as its row's Open would. `n` distinguishes asking twice for the same
     * routine, which must reopen it: the person may have wandered off to another in between.
     */
    openRequest?: {
        name: string;
        n: number;
    } | null;
    /** Open the agent that holds a routine, where its stage is set. Omitted, the studio names the agent without a way to it. */
    onOpenAgent?(agent: string): void;
}
export interface QueryHistoryEntry {
    cypher: string;
    rows: number | null;
    at: string;
}
export interface KgFill {
    id: string;
    cypher?: string;
    label?: string;
    progress?: {
        state?: string;
        ticks?: number;
        liveCallsTotal?: number;
        lastError?: string | null;
    };
}
export interface FillServices {
    list(): Promise<Outcome<KgFill[]>>;
    create(cypher: string, label: string): Promise<Outcome<KgFill>>;
    delete(id: string): Promise<Outcome<void>>;
}
export interface InteractiveEntry {
    key: number;
    input: string;
    ran?: string;
    tone: 'ok' | 'error' | 'note';
    text: string;
    scope?: string;
}
export type InteractiveBinding = SessionBinding;
export interface InteractiveSessionState {
    entries: InteractiveEntry[];
    bindings: InteractiveBinding[];
    counter: number;
    stages: string[];
    returnClause: string | null;
    inputs: string[];
}
export interface InteractiveHost {
    session: FeatureState<InteractiveSessionState>;
}
export interface QueryStudioServices {
    kg: Pick<KgClient, 'runs' | 'schema' | 'validate' | 'execute' | 'kill' | 'generate' | 'refine' | 'saveView' | 'scopes' | 'pinScope' | 'deleteScope'>;
    fills: FillServices;
    subscribeProgress(onEvent: (event: VcEvent) => void, signal: AbortSignal): void;
}
export interface QueryStudioHost {
    history: FeatureState<QueryHistoryEntry[]>;
    interactive: InteractiveHost;
}
export interface QueryStudioSurfaceProps {
    services: QueryStudioServices;
    host: QueryStudioHost;
    handedOver?: string | null;
    /** Landed once only when the editor is first created and still empty. */
    initialCypher?: string;
    /** Increment to explicitly apply the same query again after editing it. */
    handoffRevision?: number;
    /** Current editor text, including generated and recalled queries. */
    onCypherChange?(cypher: string): void;
}
export interface McpProbe {
    status?: number;
}
export interface McpModePayload {
    mode?: string;
    modes?: string[];
}
export interface McpModeMutation {
    message?: string;
}
export interface AgentCredential {
    kind: 'basic' | 'bearer';
    value: string;
    username?: string;
}
export interface AgentConnection {
    client: 'claude' | 'codex';
    baseUrl: string;
    credential: AgentCredential;
}
export interface CodingAgentsServices {
    probeMcp(): Promise<Outcome<McpProbe>>;
    getMcpMode(): Promise<Outcome<McpModePayload>>;
    setMcpMode(mode: string): Promise<Outcome<McpModeMutation>>;
}
export interface CodingAgentsHost {
    initialBaseUrl?: string;
    currentCredential(): AgentCredential | null;
    renderConnection(command: AgentConnection): string;
}
/** The parts of a surface a host may draw in its own title row instead of the kit's. */
export interface SurfaceFrameParts {
    title: ReactNode;
    /** What acts on the whole surface: Refresh, drawn in the kit's own controls. */
    actions: ReactNode;
    /**
     * What Refresh does, for a host that draws its own control instead of `actions` — so a Refresh
     * on a host's title row is that host's button, like every other one there.
     */
    refresh: () => void;
    children: ReactNode;
}
export interface CodingAgentsSurfaceProps {
    services: CodingAgentsServices;
    host: CodingAgentsHost;
    /**
     * Draws the title and actions. Omitted, the surface is a titled panel of its own. A host that
     * already titles the place it shows the surface — a settings pane — passes one that puts
     * `actions` on that title row and does not repeat `title`.
     */
    frame?: (parts: SurfaceFrameParts) => ReactNode;
}
/** One of the caller's keys, as the appliance is willing to describe it after minting. */
export interface ApiKeySummary {
    id: string;
    name: string;
    /** The first characters of the key — enough to recognise a leaked one, never enough to use it. */
    prefix: string;
    createdAt: string;
    lastUsedAt: string | null;
}
/** The one response that carries the whole secret. The appliance never returns it again. */
export interface MintedApiKey extends Omit<ApiKeySummary, 'lastUsedAt'> {
    key: string;
}
export interface ApiKeysServices {
    listKeys(): Promise<Outcome<ApiKeySummary[]>>;
    mintKey(name: string): Promise<Outcome<MintedApiKey>>;
    revokeKey(id: string): Promise<Outcome<void>>;
}
export interface ApiKeysHost {
    /** The origin a caller will reach, for the usage example. Omitted, the example names a placeholder. */
    initialBaseUrl?: string;
    confirmRevoke(key: ApiKeySummary): Promise<boolean>;
}
export interface ApiKeysSurfaceProps {
    services: ApiKeysServices;
    host: ApiKeysHost;
}
export interface AgentsServices {
    listAgents(): Promise<Outcome<Agent[]>>;
    setStage(name: string, stage: AgentStage, routine?: string): Promise<Outcome<Agent>>;
    sign(name: string): Promise<Outcome<Agent>>;
    versions(name: string): Promise<Outcome<AgentVersion[]>>;
}
export interface AgentsHost {
    /** Open a routine's body for editing. Omitted, routines are read-only on this surface. */
    editRoutine?(routine: string): void;
    /** Ask before signing, because the signed version becomes what runs. Omitted, signing asks nothing. */
    confirmSign?(agent: Agent): Promise<boolean>;
}
export interface AgentsSurfaceProps {
    services: AgentsServices;
    host?: AgentsHost;
    /** An agent to open first, by name. */
    initialAgent?: string;
}
//# sourceMappingURL=contracts.d.ts.map