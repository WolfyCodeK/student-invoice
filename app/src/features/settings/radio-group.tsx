// A radio group of buttons (appearance tiles and the Light/Dark switch).
// One tab stop for the group; the arrow keys, Home and End move the choice,
// which applies straight away, as with native radio buttons.
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { nextRadioIndex } from "./settings-logic";

export interface RadioOption<T extends string> {
  value: T;
  content: ReactNode;
}

interface RadioGroupProps<T extends string> {
  /** Id of the visible label for the group. */
  labelledBy: string;
  value: T;
  options: RadioOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  itemClassName?: string;
}

export function RadioGroup<T extends string>({ labelledBy, value, options, onChange, className, itemClassName }: RadioGroupProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = options.findIndex((o) => o.value === value);
    const next = nextRadioIndex(e.key, index, options.length);
    if (next === null) return;
    e.preventDefault();
    if (options[next].value !== value) onChange(options[next].value);
    buttons.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={className} onKeyDown={onKeyDown}>
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={itemClassName}
            onClick={() => !checked && onChange(o.value)}
          >
            {o.content}
          </button>
        );
      })}
    </div>
  );
}
