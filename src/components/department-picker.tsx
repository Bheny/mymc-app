"use client";

type DepartmentOption = { id: string; name: string };

export function DepartmentPicker({
  departments, selected, onChange, max = 2,
}: {
  departments: DepartmentOption[];
  selected:    string[];
  onChange:    (ids: string[]) => void;
  max?:        number;
}) {
  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else if (selected.length < max) onChange([...selected, id]);
  }

  if (departments.length === 0) {
    return (
      <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
        No departments have been created yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {departments.map((d) => {
          const checked  = selected.includes(d.id);
          const disabled = !checked && selected.length >= max;
          return (
            <label
              key={d.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors"
              style={{
                border:     "1px solid " + (checked ? "var(--brand-navy)" : "var(--brand-border)"),
                background: checked ? "var(--brand-navy-light)" : "#fff",
                color:      checked ? "var(--brand-navy)" : "var(--brand-text)",
                opacity:    disabled ? 0.45 : 1,
                cursor:     disabled ? "not-allowed" : "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(d.id)}
                className="h-3.5 w-3.5"
              />
              {d.name}
            </label>
          );
        })}
      </div>
      <p className="text-[11px]" style={{ color: "var(--brand-muted)" }}>
        {selected.length}/{max} selected
      </p>
    </div>
  );
}
