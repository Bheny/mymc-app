"use client";

/**
 * Sheet — a right-side sliding panel built on Radix Dialog.
 * Drop-in replacement for Dialog with the same open/onOpenChange API.
 *
 * Usage:
 *   <Sheet open={open} onOpenChange={setOpen}>
 *     <SheetTrigger asChild><Button>Open</Button></SheetTrigger>
 *     <SheetContent>
 *       <SheetHeader>
 *         <SheetTitle>Title</SheetTitle>
 *       </SheetHeader>
 *       ... body ...
 *       <SheetFooter>...</SheetFooter>
 *     </SheetContent>
 *   </Sheet>
 */

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Root ──────────────────────────────────────────────────────────────────────

const Sheet      = DialogPrimitive.Root;
const SheetClose = DialogPrimitive.Close;

const SheetTrigger = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>((props, ref) => <DialogPrimitive.Trigger ref={ref} {...props} />);
SheetTrigger.displayName = "SheetTrigger";

// ── Overlay ───────────────────────────────────────────────────────────────────

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "transition-all duration-200",
      className
    )}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

// ── Content ───────────────────────────────────────────────────────────────────

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Width of the panel on desktop (default 480px) */
    width?: number | string;
  }
>(({ className, children, width = 480, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Position — fixed right panel, full height
        "fixed inset-y-0 right-0 z-50 flex flex-col bg-white",
        "w-full sm:max-w-none",
        // Slide-in animation
        "data-[state=open]:animate-in  data-[state=open]:slide-in-from-right",
        "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
        "duration-200 ease-out",
        // Shadow
        "shadow-[-4px_0_24px_rgba(0,0,0,0.08)]",
        className
      )}
      style={{ width: typeof width === "number" ? width : width, maxWidth: "100vw" }}
      {...props}
    >
      {/* Close button */}
      <DialogPrimitive.Close
        className="absolute right-4 top-4 rounded-lg p-1.5 transition-colors hover:bg-[var(--brand-navy-light)]"
        style={{ color: "var(--brand-muted)" }}
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>

      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

// ── Header ────────────────────────────────────────────────────────────────────

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-0.5 px-6 pt-6 pb-4 shrink-0", className)}
      style={{ borderBottom: "1px solid var(--brand-border)" }}
      {...props}
    />
  );
}
SheetHeader.displayName = "SheetHeader";

// ── Title ─────────────────────────────────────────────────────────────────────

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-[18px] font-semibold pr-8", className)}
    style={{ color: "var(--brand-text)", lineHeight: 1.3 }}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

// ── Description ───────────────────────────────────────────────────────────────

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-[13px] mt-0.5", className)}
    style={{ color: "var(--brand-muted)" }}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

// ── Body ──────────────────────────────────────────────────────────────────────
// Scrollable middle section — grows to fill remaining height.

function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto px-6 py-5", className)}
      {...props}
    />
  );
}
SheetBody.displayName = "SheetBody";

// ── Footer ────────────────────────────────────────────────────────────────────

function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2 px-6 py-4 shrink-0", className)}
      style={{ borderTop: "1px solid var(--brand-border)" }}
      {...props}
    />
  );
}
SheetFooter.displayName = "SheetFooter";

export {
  Sheet, SheetTrigger, SheetClose,
  SheetContent, SheetHeader, SheetTitle, SheetDescription,
  SheetBody, SheetFooter,
};
