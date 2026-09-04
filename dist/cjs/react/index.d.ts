import { type ButtonHTMLAttributes, type ComponentPropsWithoutRef, type ComponentPropsWithRef, type ElementType, type HTMLAttributes, type ReactElement, type ReactNode, type SVGProps } from 'react';
export { getTabbable, useFocusTrap } from './useFocusTrap.ts';
type PolymorphicProps<Tag extends ElementType, OwnProps> = Tag extends ElementType ? OwnProps & {
    as?: Tag;
} & Omit<ComponentPropsWithoutRef<Tag>, keyof OwnProps | 'as'> : never;
type PolymorphicComponent<Tag extends ElementType, DefaultTag extends Tag, OwnProps> = <As extends Tag = DefaultTag>(props: PolymorphicProps<As, OwnProps> & {
    ref?: ComponentPropsWithRef<As>['ref'];
}) => ReactElement | null;
export type ButtonIntent = 'primary' | 'secondary' | 'quiet' | 'destructive';
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    intent?: ButtonIntent;
    loading?: boolean;
    children: ReactNode;
}
export declare const Button: import("react").ForwardRefExoticComponent<ButtonProps & import("react").RefAttributes<HTMLButtonElement>>;
type CardElement = 'div' | 'li';
type CardOwnProps = {
    children: ReactNode;
};
export type CardProps<Tag extends CardElement = 'div'> = PolymorphicProps<Tag, CardOwnProps>;
export declare const Card: PolymorphicComponent<CardElement, "div", CardOwnProps>;
type PanelElement = 'section' | 'div';
type PanelOwnProps = {
    children: ReactNode;
};
export type PanelProps<Tag extends PanelElement = 'section'> = PolymorphicProps<Tag, PanelOwnProps>;
export declare const Panel: PolymorphicComponent<PanelElement, "section", PanelOwnProps>;
export interface PanelBodyProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
}
export declare const PanelBody: import("react").ForwardRefExoticComponent<PanelBodyProps & import("react").RefAttributes<HTMLDivElement>>;
type TabListElement = 'div' | 'nav';
type TabListOwnProps = {
    children: ReactNode;
};
export type TabListProps<Tag extends TabListElement = 'div'> = PolymorphicProps<Tag, TabListOwnProps>;
export declare const TabList: PolymorphicComponent<TabListElement, "div", TabListOwnProps>;
export interface TabProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    selected: boolean;
    children: ReactNode;
}
export declare const Tab: import("react").ForwardRefExoticComponent<TabProps & import("react").RefAttributes<HTMLButtonElement>>;
export type StatusPillTone = 'neutral' | 'ok' | 'error' | 'caution';
export interface StatusPillProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
    tone: StatusPillTone;
    word: string;
}
export declare const StatusPill: import("react").ForwardRefExoticComponent<StatusPillProps & import("react").RefAttributes<HTMLSpanElement>>;
export interface SettingRowProps {
    icon: (props: SVGProps<SVGSVGElement>) => ReactNode;
    title: string;
    description: string;
    children: ReactNode;
    stacked?: boolean;
    center?: ReactNode;
}
export declare function SettingRow({ icon: Icon, title, description, children, stacked, center, }: SettingRowProps): import("react").JSX.Element;
export interface SettingGroupProps {
    heading: string;
    note?: string;
    children: ReactNode;
}
export declare function SettingGroup({ heading, note, children }: SettingGroupProps): import("react").JSX.Element;
export interface ReceiptStripProps {
    sources?: number;
    actions?: number;
    updates?: number;
    durationMs?: number;
    expandable?: boolean;
    children?: ReactNode;
    className?: string;
    expanded?: boolean;
    onExpandedChange?: (next: boolean) => void;
    toggleLabel?: string;
}
export declare function formatReceiptLine({ sources, actions, updates, durationMs, }: Pick<ReceiptStripProps, 'sources' | 'actions' | 'updates' | 'durationMs'>): string;
export declare function ReceiptStrip({ sources, actions, updates, durationMs, expandable, children, className, expanded, onExpandedChange, toggleLabel, }: ReceiptStripProps): import("react").JSX.Element;
//# sourceMappingURL=index.d.ts.map