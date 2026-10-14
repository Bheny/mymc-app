"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useActiveRole } from "@/hooks/use-active-role";
import { Cascade, usePicker } from "@/components/members/move-shared";
import { MoveBoard } from "@/components/members/move-board";
import { MoveTransfer } from "@/components/members/move-transfer";

// Move members between shepherds, cells, buscentres and MCs.
//   Board    — see a cell or buscentre at a glance and drag people between shepherds
//   Transfer — pick a shepherd, tick who goes, send them anywhere
// Both go through /api/members/move, which checks you lead both ends and keeps history.

type Mode = "board" | "transfer";

export default function MoveMembersPage() {
  const { activeView, ready } = useActiveRole();
  const [mode, setMode] = useState<Mode>("board");
  const picker = usePicker("buscentre");

  const role = activeView?.role;
  // Cell shepherds see their own cell, buscentre heads their buscentre; everyone above chooses
  const ownQuery =
    role === "cell_shepherd"  && activeView?.cellId      ? `cellId=${activeView.cellId}` :
    role === "buscentre_head" && activeView?.buscentreId ? `buscentreId=${activeView.buscentreId}` : null;
  const boardQuery = ownQuery ?? (picker.buscentreId ? `buscentreId=${picker.buscentreId}` : null);
  const chooses = !ownQuery;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto flex flex-col gap-5">
      <Link href="/members" className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: "var(--brand-muted)" }}>
        <ArrowLeft className="h-4 w-4" /> Members
      </Link>
      <div>
        <h1 className="text-[20px] font-semibold" style={{ color: "var(--brand-text)" }}>Move members</h1>
        <p className="text-[13px] mt-1 max-w-2xl" style={{ color: "var(--brand-muted)" }}>
          You can move people within the part of the church you lead. Leaders and shepherds can&apos;t be moved here, and every move is recorded.
        </p>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: "var(--brand-border)" }} role="tablist">
        {([["board", "Board"], ["transfer", "Transfer"]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
                  className="px-4 py-2 text-[14px] font-medium -mb-px border-b-2"
                  style={{ borderColor: mode === k ? "var(--brand-navy)" : "transparent", color: mode === k ? "var(--brand-link)" : "var(--brand-muted)" }}>
            {label}
          </button>
        ))}
      </div>

      {!ready ? (
        <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>Loading…</p>
      ) : role === "shepherd" ? (
        <p className="text-[14px]" style={{ color: "var(--brand-text)" }}>Moving members is done by cell shepherds and above. Ask yours to move them.</p>
      ) : mode === "board" ? (
        <>
          {chooses && (
            <div className="max-w-sm">
              <p className="text-[12px] font-medium uppercase tracking-[0.04em] mb-2" style={{ color: "var(--brand-muted)" }}>Which buscentre?</p>
              <Cascade p={picker} depth="buscentre" />
            </div>
          )}
          <MoveBoard query={boardQuery ?? ""} />
        </>
      ) : (
        <MoveTransfer />
      )}
    </div>
  );
}
