"use client";

import React from "react";
import { MicroLoader } from "@/components/loading";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline" | "accent";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      fullWidth = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      "inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none";

    const sizeClasses = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base",
    };

    const variantClasses = {
      primary: "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white shadow-md hover:shadow-lg",
      secondary: "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] hover:bg-blue-100",
      accent: "bg-gradient-to-br from-[#FFBA09] via-[#FFBA09] to-[#FF9500] text-[#011F7B] shadow-[0_8px_30px_rgb(255,186,9,0.3)] hover:shadow-[0_8px_35px_rgb(255,186,9,0.4)] border border-white/20",
      danger: "bg-red-50 text-red-600 hover:bg-red-100",
      ghost: "bg-transparent text-[var(--color-text-muted)] hover:bg-gray-100",
      outline: "border border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:bg-gray-50",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
        {...props}
      >
        {isLoading && <MicroLoader size="md" className="mr-2" />}
        {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
