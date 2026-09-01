/**
 * Travelog MVP1 — Error alert component
 */

interface ErrorAlertProps {
  message: string;
}

export default function ErrorAlert({ message }: ErrorAlertProps) {
  return (
    <div className="alert alert-error" role="alert">
      {message}
    </div>
  );
}
