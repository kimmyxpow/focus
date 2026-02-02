import * as React from "react"

import { cn } from "@/client/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'dark' | 'ghost' | 'interactive';
  }
>(({ className, variant = 'default', ...props }, ref) => {
  // Refined card styling: subtle borders, cohesive backgrounds, modern shadows
  const variants = {
    // Light mode: nearly borderless with subtle shadow for depth
    default: "bg-white/80 backdrop-blur-sm shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_1px_3px_0_rgba(0,0,0,0.02)]",
    // Dark mode: seamless with page background, subtle separation via opacity
    dark: "bg-white/[0.03] backdrop-blur-sm text-white",
    // Ghost: transparent with blur
    ghost: "bg-white/40 backdrop-blur-md",
    // Interactive: subtle hover elevation
    interactive: "bg-white/80 backdrop-blur-sm shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
  };

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl text-neutral-900",
        variants[variant],
        className
      )}
      {...props}
    />
  );
})
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-5 pb-3", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight text-neutral-900", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-neutral-500 leading-relaxed", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-5 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
