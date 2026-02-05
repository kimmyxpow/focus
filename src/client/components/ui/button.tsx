import * as React from "react"
import { cn } from "@/client/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseClasses = "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"

    const variantClasses = {
      default: "bg-stone-900 text-white shadow-sm hover:bg-stone-800 active:bg-stone-950",
      destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800",
      outline: "bg-white shadow-[inset_0_0_0_1px_theme(colors.stone.200)] hover:bg-stone-50 hover:shadow-[inset_0_0_0_1px_theme(colors.stone.300)] active:bg-stone-100",
      secondary: "bg-stone-100 text-stone-900 shadow-sm hover:bg-stone-200 active:bg-stone-300",
      ghost: "text-stone-600 hover:bg-stone-100 hover:text-stone-900 active:bg-stone-200",
      link: "text-stone-900 underline-offset-4 hover:underline"
    }

    const sizeClasses = {
      default: "h-10 px-4 py-2 rounded-lg",
      sm: "h-8 px-3 text-xs rounded-md",
      lg: "h-12 px-6 text-base rounded-lg",
      icon: "h-10 w-10 rounded-lg"
    }

    const classes = cn(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      className
    )

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
