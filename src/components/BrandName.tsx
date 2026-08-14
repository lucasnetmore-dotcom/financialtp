import { cn } from "@/lib/utils";

export function BrandName({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span className={cn("font-display font-bold tracking-tight", className)}>
        Finance <span className="gold-text">Flow AI</span>
      </span>
    );
  }
  return (
    <span className={cn("font-display font-bold tracking-tight", className)}>
      Finance <span className="gold-text">Flow AI</span>
    </span>
  );
}

export const BRAND_NAME = "Finance Flow AI";
