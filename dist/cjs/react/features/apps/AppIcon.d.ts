import React from 'react';
import { type Icon } from '@phosphor-icons/react';
/** The glyph for an app that declares no icon of its own. Never null — a window is an app. */
export declare function glyphFor(name: string, description?: string | null): Icon;
/**
 * An app's own icon where it ships one, a guessed glyph where it does not.
 *
 * `onError` matters more than it looks: the server checks the icon file exists when it
 * builds the listing, but a PIN outlives the listing that made it, and the app it names
 * can be deleted or its realm uninstalled. Without this, a stale pin shows as a broken
 * image in the shell of every tab.
 */
export declare function AppIcon({ src, name, description, size, className }: {
    src?: string | null;
    name: string;
    description?: string | null;
    size?: number;
    className?: string;
}): React.JSX.Element;
//# sourceMappingURL=AppIcon.d.ts.map