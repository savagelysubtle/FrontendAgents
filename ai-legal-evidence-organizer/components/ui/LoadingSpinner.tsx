
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', message }) => {
  let spinnerSizeClass = 'h-8 w-8';
  if (size === 'sm') spinnerSizeClass = 'h-5 w-5';
  if (size === 'lg') spinnerSizeClass = 'h-12 w-12';

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div
        className={`${spinnerSizeClass} animate-spin rounded-full border-4 border-solid border-primary border-t-transparent`}
      ></div>
      {message && <p className="text-sm text-textSecondary">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
    