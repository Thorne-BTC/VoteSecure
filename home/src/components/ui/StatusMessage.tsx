import { type ReactNode } from 'react';

type StatusType = 'info' | 'success' | 'warning' | 'error';

interface StatusMessageProps {
  children: ReactNode;
  type?: StatusType;
  className?: string;
}

export function StatusMessage({
  children,
  type = 'info',
  className = ''
}: StatusMessageProps) {
  const baseClass = 'status-message';
  const typeClass = `status-${type}`;
  const classes = `${baseClass} ${typeClass} ${className}`.trim();

  return (
    <div className={classes}>
      {children}
    </div>
  );
}