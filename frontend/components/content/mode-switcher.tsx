type ModeSwitcherProps = {
  value: string;
  modes: Array<{
    label: string;
    description: string;
    value: string;
  }>;
  onChange: (value: string) => void;
};

export function ModeSwitcher({ value, modes, onChange }: ModeSwitcherProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-1.5">
      <div className="grid gap-1.5 md:grid-cols-2">
        {modes.map((mode) => {
          const active = value === mode.value;

          return (
            <button
              key={mode.value}
              className={`rounded-xl px-4 py-3 text-start transition ${
                active
                  ? "bg-card shadow-panel ring-1 ring-primary/20"
                  : "bg-transparent hover:bg-card/70"
              }`}
              onClick={() => onChange(mode.value)}
              type="button"
            >
              <p
                className={`text-sm font-semibold ${
                  active ? "text-primary" : "text-foreground"
                }`}
              >
                {mode.label}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                {mode.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
