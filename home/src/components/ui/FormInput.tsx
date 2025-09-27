import { type ChangeEvent } from 'react';

interface FormInputProps {
  id: string;
  label: string;
  type?: 'text' | 'number' | 'email' | 'password';
  value: string | number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  min?: string | number;
  disabled?: boolean;
  required?: boolean;
}

export function FormInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  min,
  disabled = false,
  required = false
}: FormInputProps) {
  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label">
        {label}
        {required && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
      </label>
      <input
        id={id}
        type={type}
        className="form-input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        disabled={disabled}
        required={required}
      />
    </div>
  );
}