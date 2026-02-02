import * as React from "react"

import { cn } from "@/client/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'dark';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = 'default', ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base styles
          "flex h-10 w-full px-3 py-2 text-sm transition-all",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Standardized radius (--radius-sm = 6px)
          "rounded-md",
          // Variant styles
          variant === 'dark' ? [
            "bg-white/5 text-white placeholder:text-white/30",
            "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]",
            "focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),0_0_0_3px_rgba(255,255,255,0.05)]",
          ] : [
            "bg-white text-stone-900 placeholder:text-stone-400",
            "shadow-[inset_0_0_0_1px_theme(colors.stone.200)]",
            "focus:outline-none focus:shadow-[inset_0_0_0_1px_theme(colors.stone.400),0_0_0_3px_rgba(120,113,108,0.1)]",
          ],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
