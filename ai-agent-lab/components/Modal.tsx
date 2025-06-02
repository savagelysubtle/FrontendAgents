import React, { Fragment } from 'react';
import { ACCENT_COLOR } from '../constants';
// Using a basic modal structure, can be enhanced with Headless UI or Radix UI later
// For simplicity, direct DOM manipulation for focus trap is omitted.

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm p-4"
      onClick={onClose} // Close on backdrop click
    >
      <div
        className={`relative w-full ${sizeClasses[size]} bg-[var(--modal-background)] rounded-lg shadow-xl flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside modal content
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
            <button
              onClick={onClose}
              className={`text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--modal-background)]`}
              aria-label="Close modal"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-grow">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end p-4 border-t border-[var(--border-primary)] space-x-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;