interface LoadingSpinnerProps {
  text?: string;
  className?: string;
}

export function LoadingSpinner({
  text = 'Loading...',
  className = ''
}: LoadingSpinnerProps) {
  return (
    <span className={`loading ${className}`}>
      {text}
    </span>
  );
}