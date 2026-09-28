import type { ComponentChildren, JSX } from "preact";

/** Optional sound hook for every Button/Chip press (wire your sfx here). */
let clickSound: (() => void) | null = null;
export function configureUi(o: { click?: () => void }) {
  clickSound = o.click ?? null;
}

export type Tone = "primary" | "alt" | "danger" | "ghost";

type ButtonProps = Omit<JSX.HTMLAttributes<HTMLButtonElement>, "size"> & {
  tone?: Tone;
  small?: boolean;
  disabled?: boolean;
};

export function Button({ tone = "primary", small, class: cls, onClick, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      class={`btn ${tone} ${small ? "small" : ""} ${cls ?? ""}`}
      onClick={(e) => {
        clickSound?.();
        onClick?.(e);
      }}
      {...rest}
    />
  );
}

export function Panel(props: { title?: ComponentChildren; right?: ComponentChildren; class?: string; children?: ComponentChildren }) {
  return (
    <section class={`panel ui-panel ${props.class ?? ""}`}>
      {props.title && (
        <header class="panel-head">
          <h3>{props.title}</h3>
          {props.right}
        </header>
      )}
      {props.children}
    </section>
  );
}

export type MeterTone = "green" | "blue" | "red" | "gold";

export function Meter(props: { value: number; max?: number; tone?: MeterTone; label?: string }) {
  const pct = Math.max(0, Math.min(100, (props.value / (props.max ?? 100)) * 100));
  return (
    <div class="meter" role="meter" aria-valuenow={Math.round(props.value)} aria-valuemin={0} aria-valuemax={props.max ?? 100} aria-label={props.label}>
      <i class={props.tone ?? "green"} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Label/value row (or a compact column inside a top bar). */
export function Stat(props: { label: string; value: ComponentChildren; tone?: "good" | "bad" }) {
  return (
    <div class={`stat ${props.tone ?? ""}`}>
      <span>{props.label}</span>
      <b>{props.value}</b>
    </div>
  );
}

export function Empty({ children }: { children: ComponentChildren }) {
  return <p class="empty">{children}</p>;
}

export function Tag(props: { tone?: "red" | "green" | "gold"; children: ComponentChildren }) {
  return <span class={`tag ${props.tone ?? ""}`}>{props.children}</span>;
}

/** Row of toggle chips; one value selected. */
export function Choice<T extends string>(props: {
  value: T;
  options: readonly T[];
  label?: (v: T) => ComponentChildren;
  onPick: (v: T) => void;
  class?: string;
}) {
  return (
    <div class={`choices ${props.class ?? ""}`} role="radiogroup">
      {props.options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={o === props.value}
          class={`chip ${o === props.value ? "on" : ""}`}
          onClick={() => {
            clickSound?.();
            props.onPick(o);
          }}
        >
          {props.label ? props.label(o) : o}
        </button>
      ))}
    </div>
  );
}

export function Swatches(props: { value: string; colors: readonly string[]; onPick: (c: string) => void }) {
  return (
    <div class="swatches" role="radiogroup">
      {props.colors.map((c) => (
        <button
          type="button"
          role="radio"
          aria-checked={c === props.value}
          aria-label={c}
          class={`swatch ${c === props.value ? "on" : ""}`}
          style={{ background: c }}
          onClick={() => props.onPick(c)}
        />
      ))}
    </div>
  );
}

/** Big selectable card (option pickers, facilities, shop items). */
export function CardButton(props: {
  on?: boolean;
  disabled?: boolean;
  title: ComponentChildren;
  children?: ComponentChildren;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      class={`card-btn ${props.on ? "on" : ""}`}
      onClick={() => {
        clickSound?.();
        props.onClick?.();
      }}
    >
      <b>{props.title}</b>
      {props.children}
    </button>
  );
}

/** Label + control grid row. */
export function Field(props: { label: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class="field">
      <span>{props.label}</span>
      {props.children}
    </div>
  );
}

export interface TabDef<T extends string> {
  id: T;
  label: ComponentChildren;
  badge?: number;
}

export function Tabs<T extends string>(props: { tabs: TabDef<T>[]; value: T; onPick: (t: T) => void; label?: string }) {
  return (
    <nav class="tabs" aria-label={props.label}>
      {props.tabs.map((t) => (
        <button
          type="button"
          class={`tab ${t.id === props.value ? "on" : ""}`}
          aria-current={t.id === props.value ? "page" : undefined}
          onClick={() => {
            clickSound?.();
            props.onPick(t.id);
          }}
        >
          {t.label}
          {!!t.badge && <i class="badge">{t.badge}</i>}
        </button>
      ))}
    </nav>
  );
}

export function Modal(props: { title?: ComponentChildren; onClose?: () => void; children: ComponentChildren; role?: "dialog" | "alertdialog" }) {
  return (
    <div class="modal-back" onClick={props.onClose}>
      <div class="modal panel" role={props.role ?? "dialog"} aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {props.title && <h2>{props.title}</h2>}
        {props.children}
      </div>
    </div>
  );
}

export interface ConfirmOptions {
  title: string;
  text: ComponentChildren;
  yes: string;
  no?: string;
  danger?: boolean;
}

export function ConfirmDialog(props: ConfirmOptions & { onYes: () => void; onNo: () => void }) {
  return (
    <Modal title={props.title} onClose={props.onNo} role="alertdialog">
      <p>{props.text}</p>
      <div class="modal-actions">
        <Button tone={props.danger ? "danger" : "primary"} onClick={props.onYes}>
          {props.yes}
        </Button>
        <Button tone="ghost" onClick={props.onNo}>
          {props.no ?? "CANCEL"}
        </Button>
      </div>
    </Modal>
  );
}

export interface ToastItem {
  id: number;
  text: ComponentChildren;
  tone?: "good" | "bad" | "info";
}

export function Toasts({ items }: { items: ToastItem[] }) {
  return (
    <div class="toasts" aria-live="polite">
      {items.map((t) => (
        <div class={`toast ${t.tone ?? "info"}`}>{t.text}</div>
      ))}
    </div>
  );
}

export const money = (n: number, symbol = "$") =>
  `${n < 0 ? "-" : ""}${symbol}${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
