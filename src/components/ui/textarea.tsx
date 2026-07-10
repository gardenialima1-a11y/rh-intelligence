import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(props, ref) {
  const { className, ...rest } = props;
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3.5 py-2 text-sm shadow-[var(--shadow-xs)] transition-all duration-150 placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...rest}
    />
  );
});

export { Textarea };
