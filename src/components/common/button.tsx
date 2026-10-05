import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "neutral"
  | "danger"
  | "subtle"
  | "ghost";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      className = "",
      disabled,
      children,
      ...props
    },
    ref,
  ) {
    const variantClass = (() => {
      switch (variant) {
        case "primary":
          return "affirmative-action btn-primary";
        case "secondary":
        case "neutral":
          return "neutral-action btn-secondary";
        case "danger":
          return "danger-action btn-danger";
        case "subtle":
        case "ghost":
          return "toolbar-btn-subtle btn-subtle";
        default:
          return "affirmative-action btn-primary";
      }
    })();

    const sizeClass = `btn-${size}`;
    const combinedClassName = ["btn", variantClass, sizeClass, className]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        className={combinedClassName}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="btn-spinner" aria-hidden="true" />
        ) : leftIcon ? (
          <span className="btn-icon btn-icon-left" aria-hidden="true">
            {leftIcon}
          </span>
        ) : null}
        {children ? <span className="btn-label">{children}</span> : null}
        {!isLoading && rightIcon ? (
          <span className="btn-icon btn-icon-right" aria-hidden="true">
            {rightIcon}
          </span>
        ) : null}
      </button>
    );
  },
);

Button.displayName = "Button";
