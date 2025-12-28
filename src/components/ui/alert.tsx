import * as React from "react"
import { cn } from "@/lib/utils"

const Alert = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" | "success" | "warning" }
>(({ className, variant = "default", ...props }, ref) => {
    const variants = {
        default: "bg-background text-foreground",
        destructive: "border-red-500/50 text-red-500 [&>svg]:text-red-500",
        success: "border-green-500/50 text-green-500 [&>svg]:text-green-500",
        warning: "border-yellow-500/50 text-yellow-500 [&>svg]:text-yellow-500",
    }

    return (
        <div
            ref={ref}
            role="alert"
            className={cn(
                "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
                variants[variant],
                className
            )}
            {...props}
        />
    )
})
Alert.displayName = "Alert"

const AlertDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("text-sm [&_p]:leading-relaxed pl-7", className)}
        {...props}
    />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertDescription }
