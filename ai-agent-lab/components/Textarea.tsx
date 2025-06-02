import React from 'react';
import { ACCENT_COLOR } from '../constants';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  textareaClassName?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, id, error, className = '', textareaClassName = '', ...props }, ref) => {
    const baseTextareaStyles = `block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none sm:text-sm bg-[var(--input-background)] text-[var(--input-text)] disabled:opacity-50 disabled:cursor-not-allowed`;
    const normalBorder = 'border-[var(--input-border)]';
    const errorBorder = 'border-red-500 dark:border-red-400'; // Could use a CSS var for danger border too
    const focusStyles = `focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--page-background)] focus:ring-[var(--input-focus-ring)] focus:border-[var(--input-focus-ring)]`;
    
    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            {label}
          </label>
        )}
        <textarea
          id={id}
          ref={ref}
          className={`${baseTextareaStyles} ${error ? errorBorder : normalBorder} ${focusStyles} ${textareaClassName}`}
          rows={4}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea'; // Optional: for better debugging

export default Textarea;