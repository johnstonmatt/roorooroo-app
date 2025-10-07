"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  formatPhoneNumberAsYouType,
  type PhoneValidationResult,
  validatePhoneNumber,
} from "@/lib/phone-validation";

export interface PhoneInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value: string;
  onChange: (value: string, validation: PhoneValidationResult) => void;
  error?: string;
  placeholder?: string;
  defaultCountry?: "US" | "CA" | "GB" | "AU";
  showValidationIcon?: boolean;
  validateOnChange?: boolean;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({
    className,
    value = "",
    onChange,
    error,
    placeholder = "Enter phone number",
    defaultCountry = "US",
    showValidationIcon = true,
    validateOnChange = true,
    ...props
  }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(value);
    const [validation, setValidation] = React.useState<PhoneValidationResult>({
      isValid: false,
    });
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasBeenBlurred, setHasBeenBlurred] = React.useState(false);

    // Update display value when prop value changes
    React.useEffect(() => {
      setDisplayValue(value);
    }, [value]);

    // Validate phone number
    const validateNumber = React.useCallback((phoneNumber: string) => {
      if (!phoneNumber.trim()) {
        return { isValid: false, error: undefined };
      }
      return validatePhoneNumber(phoneNumber, defaultCountry);
    }, [defaultCountry]);

    // Handle input change with real-time formatting
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Format as user types for better UX
      const formattedValue = formatPhoneNumberAsYouType(
        inputValue,
        defaultCountry,
      );
      setDisplayValue(formattedValue);

      // Validate if enabled
      let validationResult: PhoneValidationResult = { isValid: false };
      if (validateOnChange) {
        validationResult = validateNumber(inputValue);
        setValidation(validationResult);
      }

      // Call onChange with original input value and validation
      onChange(inputValue, validationResult);
    };

    // Handle focus
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    // Handle blur - validate on blur if not validating on change
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setHasBeenBlurred(true);

      if (!validateOnChange) {
        const validationResult = validateNumber(displayValue);
        setValidation(validationResult);
        onChange(displayValue, validationResult);
      }

      props.onBlur?.(e);
    };

    // Determine if we should show validation state
    const shouldShowValidation = hasBeenBlurred ||
      (validateOnChange && displayValue.length > 0);
    const hasError = error || (shouldShowValidation && validation.error);
    const isValid = shouldShowValidation && validation.isValid && !error;

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="tel"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            // Add padding for validation icon if enabled
            showValidationIcon && "pr-10",
            // Error state styling
            hasError && "border-destructive focus-visible:border-destructive",
            // Valid state styling (subtle green border)
            isValid && "border-green-500 focus-visible:border-green-500",
            className,
          )}
          aria-invalid={!!hasError}
          aria-describedby={hasError ? `${props.id}-error` : undefined}
          {...props}
        />

        {/* Validation Icon */}
        {showValidationIcon && shouldShowValidation && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid
              ? <CheckIcon className="h-4 w-4 text-green-500" />
              : hasError
              ? <XIcon className="h-4 w-4 text-destructive" />
              : null}
          </div>
        )}

        {/* Error Message */}
        {hasError && (
          <p
            id={`${props.id}-error`}
            className="mt-1 text-sm text-destructive"
          >
            {error || validation.error}
          </p>
        )}

        {/* Format Hint */}
        {!hasError && !isFocused && !displayValue && (
          <p className="mt-1 text-xs text-muted-foreground">
            Format: +1 (234) 567-8900 or 234-567-8900
          </p>
        )}
      </div>
    );
  },
);

PhoneInput.displayName = "PhoneInput";

// Simple icons for validation states
const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

export { PhoneInput };
