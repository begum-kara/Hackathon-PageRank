import * as React from "react"
import { cn } from "../../lib/utils"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-xl border border-slate-200/10", className)}
      {...props}
    />
  )
}
