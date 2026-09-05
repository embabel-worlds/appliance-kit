import {
  Children,
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  type ElementType,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SVGProps,
} from 'react'
import { formatDuration } from '../studio-kit/format.ts'

export { getTabbable, useFocusTrap } from './useFocusTrap.ts'

const classes = (...names: Array<string | undefined | false>) => names.filter(Boolean).join(' ')

type PolymorphicProps<Tag extends ElementType, OwnProps> = Tag extends ElementType
  ? OwnProps &
      { as?: Tag } &
      Omit<ComponentPropsWithoutRef<Tag>, keyof OwnProps | 'as'>
  : never

type PolymorphicComponent<Tag extends ElementType, DefaultTag extends Tag, OwnProps> = <
  As extends Tag = DefaultTag,
>(
  props: PolymorphicProps<As, OwnProps> & { ref?: ComponentPropsWithRef<As>['ref'] },
) => ReactElement | null

export type ButtonIntent = 'primary' | 'secondary' | 'quiet' | 'destructive'

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  intent?: ButtonIntent
  loading?: boolean
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    intent = 'secondary',
    loading = false,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={classes('kit-button', intent, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
    >
      {loading ? <span className="kit-button__spinner" aria-hidden="true" /> : null}
      <span className="kit-button__label">{children}</span>
    </button>
  )
})

type CardElement = 'div' | 'li'
type CardOwnProps = { children: ReactNode }
export type CardProps<Tag extends CardElement = 'div'> = PolymorphicProps<Tag, CardOwnProps>

const CardImplementation = forwardRef(function Card(
  { as = 'div', className, children, ...rest }: CardProps<CardElement>,
  ref: ForwardedRef<HTMLDivElement | HTMLLIElement>,
) {
  return createElement(as, { ...rest, ref, className: classes('card', className) }, children)
})

export const Card = CardImplementation as PolymorphicComponent<CardElement, 'div', CardOwnProps>

type PanelElement = 'section' | 'div'
type PanelOwnProps = { children: ReactNode }
export type PanelProps<Tag extends PanelElement = 'section'> = PolymorphicProps<Tag, PanelOwnProps>

const PanelImplementation = forwardRef(function Panel(
  { as = 'section', className, children, ...rest }: PanelProps<PanelElement>,
  ref: ForwardedRef<HTMLElement>,
) {
  return createElement(as, { ...rest, ref, className: classes('panel', className) }, children)
})

export const Panel = PanelImplementation as PolymorphicComponent<
  PanelElement,
  'section',
  PanelOwnProps
>

export interface PanelBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export const PanelBody = forwardRef<HTMLDivElement, PanelBodyProps>(function PanelBody(
  { className, children, ...rest },
  ref,
) {
  return (
    <div {...rest} ref={ref} className={classes('panel-body', className)}>
      {children}
    </div>
  )
})

export interface ChatWorkspaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  header?: ReactNode
  toolbar?: ReactNode
  workPane?: ReactNode
  workPaneLabel?: string
  workPaneOpen?: boolean
  defaultWorkPaneOpen?: boolean
  onWorkPaneOpenChange?: (open: boolean) => void
}

const MIN_WORK_PANE_WIDTH = 30
const MAX_WORK_PANE_WIDTH = 70
const DEFAULT_WORK_PANE_WIDTH = 55

const clampWorkPaneWidth = (width: number) =>
  Math.min(MAX_WORK_PANE_WIDTH, Math.max(MIN_WORK_PANE_WIDTH, width))

export const ChatWorkspace = forwardRef<HTMLDivElement, ChatWorkspaceProps>(
  function ChatWorkspace(
    {
      children,
      header,
      toolbar,
      workPane,
      workPaneLabel = 'Work pane',
      workPaneOpen,
      defaultWorkPaneOpen = false,
      onWorkPaneOpenChange,
      className,
      style,
      ...rest
    },
    ref,
  ) {
    const hasWorkPane = Children.toArray(workPane).length > 0
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultWorkPaneOpen)
    const [workPaneWidth, setWorkPaneWidth] = useState(DEFAULT_WORK_PANE_WIDTH)
    const isControlled = workPaneOpen !== undefined
    const isOpen = hasWorkPane && (isControlled ? workPaneOpen : uncontrolledOpen)
    const toggleRef = useRef<HTMLButtonElement>(null)
    const workPaneRef = useRef<HTMLElement>(null)
    const bodyRef = useRef<HTMLDivElement>(null)
    const wasOpenRef = useRef(isOpen)
    const resizeCleanupRef = useRef<(() => void) | null>(null)
    const workPaneId = useId()
    const workPaneLabelId = useId()

    const stopResize = useCallback(() => {
      resizeCleanupRef.current?.()
      resizeCleanupRef.current = null
    }, [])

    useEffect(() => stopResize, [stopResize])

    useLayoutEffect(() => {
      if (wasOpenRef.current && !isOpen && workPaneRef.current?.contains(document.activeElement)) {
        toggleRef.current?.focus()
      }
      wasOpenRef.current = isOpen
    }, [isOpen])

    const setOpen = (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next)
      onWorkPaneOpenChange?.(next)
    }

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      const body = bodyRef.current
      if (!body) return
      const bounds = body.getBoundingClientRect()
      if (bounds.width <= 0) return

      event.preventDefault()
      stopResize()
      const handlePointerMove = (moveEvent: PointerEvent) => {
        const width = ((bounds.right - moveEvent.clientX) / bounds.width) * 100
        setWorkPaneWidth(clampWorkPaneWidth(width))
      }
      const handlePointerEnd = () => stopResize()
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerEnd)
      window.addEventListener('pointercancel', handlePointerEnd)
      resizeCleanupRef.current = () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerEnd)
        window.removeEventListener('pointercancel', handlePointerEnd)
      }
    }

    const handleSeparatorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      let nextWidth: number | undefined
      if (event.key === 'ArrowLeft') nextWidth = workPaneWidth + 5
      if (event.key === 'ArrowRight') nextWidth = workPaneWidth - 5
      if (event.key === 'Home') nextWidth = MIN_WORK_PANE_WIDTH
      if (event.key === 'End') nextWidth = MAX_WORK_PANE_WIDTH
      if (nextWidth === undefined) return
      event.preventDefault()
      setWorkPaneWidth(clampWorkPaneWidth(nextWidth))
    }

    return (
      <div
        {...rest}
        ref={ref}
        className={classes('chat-workspace', className)}
        style={style}
        data-work-pane-open={isOpen ? 'true' : 'false'}
      >
        {header !== undefined || toolbar !== undefined || hasWorkPane ? (
          <div className="chat-workspace__header">
            <div className="chat-workspace__heading">{header}</div>
            <div className="chat-workspace__toolbar">
              {toolbar}
              {hasWorkPane ? (
                <button
                  ref={toggleRef}
                  type="button"
                  className="chat-workspace__pane-button"
                  aria-controls={workPaneId}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(!isOpen)}
                >
                  {isOpen ? `Hide ${workPaneLabel}` : `Open ${workPaneLabel}`}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div ref={bodyRef} className="chat-workspace__body">
          <div className="chat-workspace__conversation">{children}</div>
          {hasWorkPane && isOpen ? (
            <div
              role="separator"
              className="chat-workspace__separator"
              tabIndex={0}
              aria-label={`${workPaneLabel} width`}
              aria-controls={workPaneId}
              aria-orientation="vertical"
              aria-valuemin={MIN_WORK_PANE_WIDTH}
              aria-valuemax={MAX_WORK_PANE_WIDTH}
              aria-valuenow={Math.round(workPaneWidth)}
              onKeyDown={handleSeparatorKeyDown}
              onPointerDown={handlePointerDown}
            />
          ) : null}
          {hasWorkPane ? (
            <aside
              ref={workPaneRef}
              id={workPaneId}
              className="chat-workspace__work-pane"
              style={{ flexBasis: `${workPaneWidth}%` }}
              aria-labelledby={workPaneLabelId}
              hidden={!isOpen}
            >
              <div className="chat-workspace__work-pane-header">
                <span id={workPaneLabelId} className="chat-workspace__work-pane-label">
                  {workPaneLabel}
                </span>
                <button
                  type="button"
                  className="chat-workspace__pane-button"
                  aria-label={`Close ${workPaneLabel}`}
                  onClick={() => setOpen(false)}
                >
                  Back to chat
                </button>
              </div>
              <div className="chat-workspace__work-pane-body">{workPane}</div>
            </aside>
          ) : null}
        </div>
      </div>
    )
  },
)

type TabListElement = 'div' | 'nav'
type TabListOwnProps = { children: ReactNode }
export type TabListProps<Tag extends TabListElement = 'div'> = PolymorphicProps<
  Tag,
  TabListOwnProps
>

const TabListImplementation = forwardRef(function TabList(
  { as = 'div', className, children, ...rest }: TabListProps<TabListElement>,
  ref: ForwardedRef<HTMLDivElement | HTMLElement>,
) {
  return createElement(
    as,
    { ...rest, ref, role: 'tablist', className: classes('tabs', className) },
    children,
  )
})

export const TabList = TabListImplementation as PolymorphicComponent<
  TabListElement,
  'div',
  TabListOwnProps
>

export interface TabProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  selected: boolean
  children: ReactNode
}

export const Tab = forwardRef<HTMLButtonElement, TabProps>(function Tab(
  { selected, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      role="tab"
      aria-selected={selected}
      className={classes('tab', selected && 'is-on', className)}
    >
      {children}
    </button>
  )
})

export type StatusPillTone = 'neutral' | 'ok' | 'error' | 'caution'

export interface StatusPillProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  tone: StatusPillTone
  word: string
}

export const StatusPill = forwardRef<HTMLSpanElement, StatusPillProps>(function StatusPill(
  { tone, word, className, ...rest },
  ref,
) {
  return (
    <span
      {...rest}
      ref={ref}
      className={classes('pill', tone !== 'neutral' && tone, className)}
    >
      <span className="dot" aria-hidden="true" />
      {word}
    </span>
  )
})

export interface SettingRowProps {
  icon: (props: SVGProps<SVGSVGElement>) => ReactNode
  title: string
  description: string
  children: ReactNode
  stacked?: boolean
  center?: ReactNode
}

export function SettingRow({
  icon: Icon,
  title,
  description,
  children,
  stacked = false,
  center,
}: SettingRowProps) {
  const hasCenter = center !== undefined
  return (
    <div
      className="setting-row"
      data-stacked={stacked ? 'true' : undefined}
      data-has-center={hasCenter ? 'true' : undefined}
    >
      <span className="setting-row__icon">
        <Icon aria-hidden="true" focusable="false" />
      </span>
      <div className="setting-row__text">
        <p className="setting-row__title">{title}</p>
        <p className="setting-row__description">{description}</p>
      </div>
      {hasCenter ? <div className="setting-row__center">{center}</div> : null}
      <div className="setting-row__control">{children}</div>
    </div>
  )
}

export interface SettingGroupProps {
  heading: string
  note?: string
  children: ReactNode
}

export function SettingGroup({ heading, note, children }: SettingGroupProps) {
  return (
    <section className="setting-group" aria-label={heading}>
      <h3 className="setting-group__heading">{heading}</h3>
      {note !== undefined ? <p className="setting-group__note">{note}</p> : null}
      {children}
    </section>
  )
}

export interface ReceiptStripProps {
  sources?: number
  actions?: number
  updates?: number
  durationMs?: number
  expandable?: boolean
  children?: ReactNode
  className?: string
  expanded?: boolean
  onExpandedChange?: (next: boolean) => void
  toggleLabel?: string
}

function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export function formatReceiptLine({
  sources,
  actions,
  updates,
  durationMs,
}: Pick<ReceiptStripProps, 'sources' | 'actions' | 'updates' | 'durationMs'>): string {
  const parts: string[] = []
  if (sources !== undefined) parts.push(pluralize(sources, 'source'))
  if (actions !== undefined) parts.push(pluralize(actions, 'action'))
  if (updates !== undefined) parts.push(pluralize(updates, 'update'))
  if (durationMs !== undefined) parts.push(formatDuration(durationMs))
  return parts.join(' · ')
}

export function ReceiptStrip({
  sources,
  actions,
  updates,
  durationMs,
  expandable = false,
  children,
  className,
  expanded,
  onExpandedChange,
  toggleLabel,
}: ReceiptStripProps) {
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(false)
  const isControlled = expanded !== undefined
  const isExpanded = isControlled ? expanded : uncontrolledExpanded
  const line = formatReceiptLine({ sources, actions, updates, durationMs })

  if (!expandable) {
    return <p className={classes('receipt', className)}>{line}</p>
  }

  const toggle = () => {
    const next = !isExpanded
    if (!isControlled) setUncontrolledExpanded(next)
    onExpandedChange?.(next)
  }

  return (
    <div className={classes('receipt', className)}>
      <button
        type="button"
        className="receipt__toggle"
        aria-expanded={isExpanded}
        aria-label={toggleLabel}
        onClick={toggle}
      >
        <span>{line}</span>
        <span className="receipt__chevron" aria-hidden="true">
          {isExpanded ? '▾' : '▸'}
        </span>
      </button>
      {isExpanded && children ? <div className="receipt__detail">{children}</div> : null}
    </div>
  )
}
