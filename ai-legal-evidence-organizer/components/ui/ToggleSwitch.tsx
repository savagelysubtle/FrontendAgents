
import React from 'react';

interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ id, checked, onChange, label, disabled = false }) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      onChange(event.target.checked);
    }
  };

  return (
    <label htmlFor={id} className={`flex items-center cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="relative">
        <input 
          id={id} 
          type="checkbox" 
          className="sr-only" 
          checked={checked} 
          onChange={handleChange} 
          disabled={disabled}
        />
        <div className={`block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
        <div 
          className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-4' : ''}`}
        ></div>
      </div>
      {label && <span className="ml-3 text-sm font-medium text-textPrimary">{label}</span>}
    </label>
  );
};

export default ToggleSwitch;
    