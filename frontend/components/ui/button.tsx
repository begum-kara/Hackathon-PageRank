import * as React from "react"
import { cn } from "../../lib/utils"

type ButtonVariant = "default" | "outline"
type ButtonSize = "default" | "lg"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-50 disabled:pointer-events-none"

    const variants: Record<ButtonVariant, string> = {
      default: "bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-50 dark:hover:bg-slate-200",
      outline:
        "border border-slate-600 bg-transparent text-white hover:bg-slate-800/40 dark:hover:bg-slate-700/40",
    }

    const sizes: Record<ButtonSize, string> = {
      default: "h-10 px-4 py-2 text-sm",
      lg: "h-12 px-6 py-3 text-base",
    }

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
