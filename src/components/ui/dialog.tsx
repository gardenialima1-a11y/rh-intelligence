"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

type OverlayElement = React.ElementRef<typeof DialogPrimitive.Overlay>;
type OverlayProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>;

function DialogOverlayImpl(props: OverlayProps, ref: React.Ref<OverlayElement>) {
  const { className, ...rest } = props;
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn("fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] animate-in fade-in-0", className)}
      {...rest}
    />
  );
}
const DialogOverlay = React.forwardRef(DialogOverlayImpl);
DialogOverlay.displayName = "DialogOverlay";

type ContentElement = React.ElementRef<typeof DialogPrimitive.Content>;
type ContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>;

function DialogContentImpl(props: ContentProps, ref: React.Ref<ContentElement>) {
  const { className, children, ...rest } = props;
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-popover)] animate-in fade-in-0 zoom-in-95 max-h-[85vh] overflow-y-auto",
          className
        )}
        {...rest}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
const DialogContent = React.forwardRef(DialogContentImpl);
DialogContent.displayName = "DialogContent";

function DialogHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <div className={cn("flex flex-col gap-1.5", className)} {...rest} />;
}

function DialogFooter(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...rest} />;
}

type TitleElement = React.ElementRef<typeof DialogPrimitive.Title>;
type TitleProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>;

function DialogTitleImpl(props: TitleProps, ref: React.Ref<TitleElement>) {
  const { className, ...rest } = props;
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-base font-semibold text-navy dark:text-cream", className)}
      {...rest}
    />
  );
}
const DialogTitle = React.forwardRef(DialogTitleImpl);
DialogTitle.displayName = "DialogTitle";

type DescriptionElement = React.ElementRef<typeof DialogPrimitive.Description>;
type DescriptionProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>;

function DialogDescriptionImpl(props: DescriptionProps, ref: React.Ref<DescriptionElement>) {
  const { className, ...rest } = props;
  return <DialogPrimitive.Description ref={ref} className={cn("text-[13px] text-muted-foreground", className)} {...rest} />;
}
const DialogDescription = React.forwardRef(DialogDescriptionImpl);
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
