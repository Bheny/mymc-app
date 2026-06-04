"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Heart, Plus, Search, Pencil, Trash2, X,
  Phone, MapPin, Calendar, StickyNote, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveRole } from "@/hooks/use-active-role";

// ─── Types ────────────────────────────────────────────────────────────────────

type Soul = {
  id:          string;
  firstName:   string;
  lastName:    string;
  phone:       string | null;
  location:    string | null;
  date:        string;
  notes:       string | null;
  createdAt:   string;
  recordedBy:  { name: string | null };
};

type FormState = {
  firstName: string;
  lastName:  string;
  phone:     string;
  location:  string;
  date:      string;
  notes:     string;
};

function emptyForm(): FormState {
  return {
    firstName: "",
    lastName:  "",
    phone:     "",
    location:  "",
    date:      new Date().toISOString().slice(0, 10),
    notes:     "",
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── Inline form ──────────────────────────────────────────────────────────────

function SoulForm({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial:  FormState;
  onSave:   (data: FormState) => void;
  onCancel: () => void;
  saving:   boolean;
  error:    string;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="rounded-xl p-5 flex flex-col gap-4"
         style={{ border: "1px solid var(--brand-border)", background: "var(--brand-navy-light)" }}>
      {/* Name row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { k: "firstName" as const, label: "First name *", placeholder: "e.g. Kofi" },
          { k: "lastName"  as const, label: "Last name *",  placeholder: "e.g. Agyeman" },
        ].map(({ k, label, placeholder }) => (
          <div key={k} className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.04em]"
                   style={{ color: "var(--brand-muted)" }}>{label}</label>
            <input value={form[k]} onChange={set(k)} placeholder={placeholder}
                   className="h-10 px-3 text-[14px] rounded-lg"
                   style={{ border: "1px solid var(--brand-border)", background: "#fff", outline: "none" }} />
          </div>
        ))}
      </div>

      {/* Contact + location + date */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { k: "phone"    as const, label: "Phone",    placeholder: "024 000 0000", icon: Phone },
          { k: "location" as const, label: "Location", placeholder: "e.g. Tema",    icon: MapPin },
        ].map(({ k, label, placeholder, icon: Icon }) => (
          <div key={k} className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.04em]"
                   style={{ color: "var(--brand-muted)" }}>{label}</label>
            <div className="relative">
              <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                    style={{ color: "var(--brand-muted)" }} />
              <input value={form[k]} onChange={set(k)} placeholder={placeholder}
                     className="h-10 pl-8 pr-3 text-[14px] rounded-lg w-full"
                     style={{ border: "1px solid var(--brand-border)", background: "#fff", outline: "none" }} />
            </div>
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-[0.04em]"
                 style={{ color: "var(--brand-muted)" }}>Date *</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                      style={{ color: "var(--brand-muted)" }} />
            <input type="date" value={form.date} onChange={set("date")}
                   className="h-10 pl-8 pr-3 text-[14px] rounded-lg w-full"
                   style={{ border: "1px solid var(--brand-border)", background: "#fff", outline: "none" }} />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium uppercase tracking-[0.04em]"
               style={{ color: "var(--brand-muted)" }}>Notes</label>
        <div className="relative">
          <StickyNote className="absolute left-3 top-3 h-3.5 w-3.5"
                      style={{ color: "var(--brand-muted)" }} />
          <textarea value={form.notes} onChange={set("notes")}
                    placeholder="How did the interaction go? Any follow-up needed?"
                    rows={3}
                    className="w-full pl-8 pr-3 py-2.5 text-[14px] rounded-lg resize-none"
                    style={{ border: "1px solid var(--brand-border)", background: "#fff", outline: "none" }} />
        </div>
      </div>

      {error && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} type="button"
                className="h-9 px-4 text-[13px] rounded-lg"
                style={{ color: "var(--brand-muted)" }}>
          Cancel
        </button>
        <Button onClick={() => onSave(form)} disabled={saving}
                className="h-9 px-5 text-[13px]"
                style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function SoulRow({
  soul, onEdit, onDelete, deleting,
}: {
  soul:     Soul;
  onEdit:   (s: Soul) => void;
  onDelete: (id: string) => void;
  deleting: string | null;
}) {
  return (
    <tr className="group border-b" style={{ borderColor: "var(--brand-border)" }}>
      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-lg shrink-0 text-[11px] font-bold"
               style={{ width: 32, height: 32, background: "var(--brand-navy)", color: "#fff" }}>
            {soul.firstName[0]}{soul.lastName[0]}
          </div>
          <div>
            <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
              {soul.firstName} {soul.lastName}
            </p>
            {soul.recordedBy.name && (
              <p className="text-[11px]" style={{ color: "var(--brand-muted)" }}>
                by {soul.recordedBy.name}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Phone */}
      <td className="px-4 py-3 hidden sm:table-cell">
        {soul.phone
          ? <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--brand-text)" }}>
              <Phone className="h-3 w-3" style={{ color: "var(--brand-muted)" }} /> {soul.phone}
            </span>
          : <span style={{ color: "var(--brand-muted)", fontSize: 12 }}>—</span>}
      </td>

      {/* Location */}
      <td className="px-4 py-3 hidden md:table-cell">
        {soul.location
          ? <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--brand-text)" }}>
              <MapPin className="h-3 w-3" style={{ color: "var(--brand-muted)" }} /> {soul.location}
            </span>
          : <span style={{ color: "var(--brand-muted)", fontSize: 12 }}>—</span>}
      </td>

      {/* Date */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-[13px]" style={{ color: "var(--brand-text)" }}>
          {formatDate(soul.date)}
        </span>
      </td>

      {/* Notes */}
      <td className="px-4 py-3 hidden lg:table-cell max-w-[260px]">
        {soul.notes
          ? <p className="text-[13px] truncate" style={{ color: "var(--brand-muted)" }}>{soul.notes}</p>
          : <span style={{ color: "var(--brand-muted)", fontSize: 12 }}>—</span>}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(soul)}
                  className="p-1.5 rounded-lg hover:bg-[var(--brand-navy-light)] transition-colors"
                  title="Edit">
            <Pencil className="h-3.5 w-3.5" style={{ color: "var(--brand-muted)" }} />
          </button>
          <button onClick={() => onDelete(soul.id)}
                  disabled={deleting === soul.id}
                  className="p-1.5 rounded-lg hover:bg-[#FDECEA] transition-colors disabled:opacity-40"
                  title="Delete">
            {deleting === soul.id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--brand-danger)" }} />
              : <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--brand-danger)" }} />}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SoulTrackerPage() {
  const { activeView } = useActiveRole();
  const actingCellId = activeView?.isActing && activeView.cellId ? activeView.cellId : null;

  const [souls,    setSouls]    = useState<Soul[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [q,        setQ]        = useState("");
  const [month,    setMonth]    = useState("");   // "YYYY-MM" or ""

  const [adding,   setAdding]   = useState(false);
  const [editing,  setEditing]  = useState<Soul | null>(null);
  const [formErr,  setFormErr]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (actingCellId) params.set("actingCellId", actingCellId);
    if (q)            params.set("q", q);
    if (month) {
      const [y, m] = month.split("-");
      params.set("year", y); params.set("month", m);
    }
    const res = await fetch(`/api/souls?${params}`);
    if (res.ok) setSouls(await res.json());
    setLoading(false);
  }, [actingCellId, q, month]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function handleSave(form: FormState) {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.date) {
      setFormErr("First name, last name and date are required."); return;
    }
    setSaving(true); setFormErr("");
    const isEdit = !!editing;
    const url  = isEdit ? `/api/souls/${editing!.id}` : "/api/souls";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, actingCellId }),
    });
    setSaving(false);
    if (res.ok) {
      setAdding(false); setEditing(null);
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setFormErr(d.error ?? "Failed to save.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this record?")) return;
    setDeleting(id);
    await fetch(`/api/souls/${id}`, { method: "DELETE" });
    setDeleting(null);
    setSouls((prev) => prev.filter((s) => s.id !== id));
  }

  const showForm = adding || !!editing;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl"
               style={{ width: 40, height: 40, background: "var(--brand-navy)" }}>
            <Heart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
              Soul Tracker
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--brand-muted)" }}>
              People you've reached out to
            </p>
          </div>
        </div>
        {!showForm && (
          <Button onClick={() => { setAdding(true); setEditing(null); setFormErr(""); }}
                  className="h-9 px-4 text-[14px] font-medium shrink-0"
                  style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
            <Plus className="mr-2 h-4 w-4" /> Add record
          </Button>
        )}
      </div>

      {/* ── Inline form (add or edit) ── */}
      {showForm && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] font-semibold" style={{ color: "var(--brand-text)" }}>
              {editing ? "Edit record" : "New record"}
            </p>
            <button onClick={() => { setAdding(false); setEditing(null); setFormErr(""); }}
                    className="p-1 rounded hover:opacity-70" style={{ color: "var(--brand-muted)" }}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <SoulForm
            initial={editing
              ? { firstName: editing.firstName, lastName: editing.lastName,
                  phone: editing.phone ?? "", location: editing.location ?? "",
                  date: editing.date.slice(0, 10), notes: editing.notes ?? "" }
              : emptyForm()}
            onSave={handleSave}
            onCancel={() => { setAdding(false); setEditing(null); setFormErr(""); }}
            saving={saving}
            error={formErr}
          />
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: "var(--brand-muted)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone or location…"
            className="w-full h-10 pl-9 pr-4 text-[14px] rounded-lg"
            style={{ border: "1px solid var(--brand-border)", outline: "none", background: "#fff" }}
          />
          {q && (
            <button onClick={() => setQ("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5" style={{ color: "var(--brand-muted)" }} />
            </button>
          )}
        </div>

        {/* Month picker */}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                    style={{ color: "var(--brand-muted)" }} />
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-10 pl-9 pr-4 text-[14px] rounded-lg"
            style={{ border: "1px solid var(--brand-border)", outline: "none", background: "#fff",
                     color: month ? "var(--brand-text)" : "var(--brand-muted)" }}
          />
          {month && (
            <button onClick={() => setMonth("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5" style={{ color: "var(--brand-muted)" }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Summary pill ── */}
      {!loading && (
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-pill text-[12px] font-medium px-3 py-1"
                style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
            {souls.length} record{souls.length !== 1 ? "s" : ""}
            {month ? ` in ${new Date(month + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}` : ""}
          </span>
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : souls.length === 0 ? (
        <div className="rounded-xl py-16 flex flex-col items-center gap-3"
             style={{ border: "2px dashed var(--brand-border)" }}>
          <Heart className="h-10 w-10" style={{ color: "var(--brand-muted)" }} />
          <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
            {q || month ? "No records match your filters" : "No souls recorded yet"}
          </p>
          {!q && !month && (
            <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
              Tap &ldquo;Add record&rdquo; to log your first outreach.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid var(--brand-border)" }}>
                {[
                  { label: "Name",     cls: "" },
                  { label: "Phone",    cls: "hidden sm:table-cell" },
                  { label: "Location", cls: "hidden md:table-cell" },
                  { label: "Date",     cls: "" },
                  { label: "Notes",    cls: "hidden lg:table-cell" },
                  { label: "",         cls: "" },
                ].map(({ label, cls }) => (
                  <th key={label}
                      className={`px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.06em] ${cls}`}
                      style={{ color: "var(--brand-muted)" }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {souls.map((soul) => (
                <SoulRow
                  key={soul.id}
                  soul={soul}
                  onEdit={(s) => { setEditing(s); setAdding(false); setFormErr(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  onDelete={handleDelete}
                  deleting={deleting}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
