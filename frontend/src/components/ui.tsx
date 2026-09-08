import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatMoneyInput, parseMoney, parsePercent } from '../utils/format';

/* ------------------------------------------------------------------ banner */

export function ErrorBanner({ message, onClose }: { message: string | null; onClose?: () => void }) {
  if (!message) return null;
  return (
    <div className="banner error" role="alert">
      <span aria-hidden="true">⚠</span>
      <span className="spacer">{message}</span>
      {onClose && (
        <button type="button" className="btn ghost small" onClick={onClose}>
          fechar
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- money */

interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  disabled?: boolean;
}

/**
 * Input de dinheiro em pt-BR: aceita "1.234,56" ou "1234.56" enquanto digita e
 * reformata ao sair do campo.
 */
export function MoneyInput({ value, onChange, ariaLabel, disabled }: MoneyInputProps) {
  const [text, setText] = useState(() => formatMoneyInput(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(formatMoneyInput(value));
  }, [value]);

  return (
    <div className="input-affix">
      <span aria-hidden="true">R$</span>
      <input
        type="text"
        inputMode="decimal"
        className="money-input"
        aria-label={ariaLabel}
        placeholder="0,00"
        disabled={disabled}
        value={text}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(event) => {
          setText(event.target.value);
          onChange(parseMoney(event.target.value));
        }}
        onBlur={() => {
          focused.current = false;
          setText(formatMoneyInput(parseMoney(text)));
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- percent */

interface PercentInputProps {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  disabled?: boolean;
}

/** Input de porcentagem que aceita vírgula e só reformata quando perde o foco. */
export function PercentInput({ value, onChange, ariaLabel, disabled }: PercentInputProps) {
  const show = (input: number) => (input === 0 ? '' : String(input).replace('.', ','));
  const [text, setText] = useState(() => show(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(show(value));
  }, [value]);

  return (
    <div className="input-affix">
      <input
        type="text"
        inputMode="decimal"
        className="money-input"
        aria-label={ariaLabel}
        placeholder="0"
        disabled={disabled}
        value={text}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(event) => {
          setText(event.target.value);
          onChange(parsePercent(event.target.value));
        }}
        onBlur={() => {
          focused.current = false;
          setText(show(parsePercent(text)));
        }}
      />
      <span aria-hidden="true" style={{ padding: '0 10px 0 2px' }}>%</span>
    </div>
  );
}

/* ------------------------------------------------------------------- modal */

interface ModalProps {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}

export function Modal({ title, children, footer, onClose }: ModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
        </header>
        <div className="body">{children}</div>
        <footer>{footer}</footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- meter */

export function Meter({ ratio, color }: { ratio: number; color: string }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0)) * 100;
  return (
    <div className="meter">
      <span style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/* ------------------------------------------------------------------- stats */

export function Stat({
  label,
  value,
  hint,
  tone
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <div className={`value tabular${tone ? ` ${tone}` : ''}`}>{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
