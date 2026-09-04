import type { AppArtifact, AppsSurfaceProps, PinRailProps } from '../contracts.ts';
export declare function validatedAppUrl(a: AppArtifact): string | null;
/**
 * THE PIN RAIL — pinned apps under the tab strip, reachable from every tab.
 *
 * Navigation by URL alone: `goTo('apps', key)` changes the hash, the shell's hashchange
 * listener moves to the Apps tab, and the Apps tab's own listener opens the named app. No
 * shared state between the rail and the tab, so the back button works on every hop.
 *
 * The click also asks to be SHOWN the app, which is not the same thing and was the bug in
 * the first cut: from the Apps tab, clicking a chip changed the URL, opened the frame — and
 * left the reader looking at the top of a directory listing with the app they had asked for
 * somewhere below the fold. It read as a dead button. Clicking a chip for the app already
 * open does nothing to the URL at all, so the reveal cannot be hung off the navigation.
 */
export declare function PinRail({ services, host }: PinRailProps): import("react").JSX.Element | null;
export declare function AppsSurface({ services, host }: AppsSurfaceProps): import("react").JSX.Element;
//# sourceMappingURL=AppsSurface.d.ts.map