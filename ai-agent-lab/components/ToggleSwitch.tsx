import React from 'react';
import { ACCENT_COLOR } from '../constants';

interface ToggleSwitchProps {
  id?: string;
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ id, label, checked, onChange, disabled = false }) => {
  const uniqueId = id || React.useId();
  
  // --accent-bg CSS variable will handle dark/light mode for checked state
  const checkedBgClass = 'bg-[var(--accent-bg)]'; 
  // Unchecked can use specific grays or a neutral variable if defined
  const uncheckedBgColor = 'bg-gray-300 dark:bg-zinc-600'; 
  
  return (
    <div className="flex items-center">
      {label && <label htmlFor={uniqueId} className="mr-3 text-sm font-medium text-[var(--text-secondary)]">{label}</label>}
      <button
        type="button"
        id={uniqueId}
        className={`${
          checked ? checkedBgClass : uncheckedBgColor
        } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--page-background)] disabled:opacity-50 disabled:cursor-not-allowed`}
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
      >
        <span className="sr-only">Use setting</span>
        <span
          aria-hidden="true"
          className={`${
            checked ? 'translate-x-5' : 'translate-x-0'
          } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
      </button>
    </div>
  );
};

export default ToggleSwitch;