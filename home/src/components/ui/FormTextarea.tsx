import { type ChangeEvent } from 'react';

interface FormTextareaProps {
  id: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
}

export function FormTextarea({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  rows = 4
}: FormTextareaProps) {
  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label">
        {label}
        {required && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
      </label>
      <textarea
        id={id}
        className="form-textarea"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={rows}
      />
    </div>
  );
}