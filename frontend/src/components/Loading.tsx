/**
 * Travelog MVP1 — Loading indicator component
 */

interface LoadingProps {
  label?: string;
}

export default function Loading({ label = "Caricamento…" }: LoadingProps) {
  return (
    <div className="loading" role="status">
      {label}
    </div>
  );
}
