import * as React from "react"
import { cn } from "@/client/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const baseClasses = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"

    const variantClasses = {
      default: "bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 active:bg-neutral-950",
      destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800",
      outline: "border border-neutral-300 bg-white shadow-sm hover:bg-neutral-50 hover:border-neutral-400 active:bg-neutral-100",
      secondary: "bg-neutral-100 text-neutral-900 shadow-sm hover:bg-neutral-200 active:bg-neutral-300",
      ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200",
      link: "text-neutral-900 underline-offset-4 hover:underline"
    }

    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-8 rounded-lg px-3 text-xs",
      lg: "h-12 rounded-xl px-6 text-base",
      icon: "h-10 w-10"
    }

    const classes = cn(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      className
    )

    if (asChild) {
      // For asChild functionality, you'd need to implement Slot from Radix
      // For now, we'll just render as a button
      console.warn("asChild prop is not supported in this custom Button implementation")
    }

    return (
      <button
        className={classes}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
