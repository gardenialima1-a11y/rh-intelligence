import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[11px] font-semibold leading-none transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        success: "border-transparent bg-success/12 text-success",
        warning: "border-transparent bg-warning/12 text-warning-text",
        danger: "border-transparent bg-danger/12 text-danger",
        gold: "border-transparent bg-gold/12 text-gold-text",
        outline: "text-foreground/80 border-border",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
