"use client";

interface Tab<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
}

export function PageTabs<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={active === tab.id ? "tab-pill-active" : "tab-pill"}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
