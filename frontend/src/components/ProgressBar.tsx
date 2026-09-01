/**
 * Travelog MVP1 — Progress bar component (Tailwind CSS)
 *
 * Determinate when a percentage is known, animated when indeterminate.
 */

interface ProgressBarProps {
  /** Percentage 0-100, or null for an indeterminate progress. */
  percent: number | null;
}

export default function ProgressBar({ percent }: ProgressBarProps) {
  if (percent === null) {
    return (
      <div
        className="h-3 w-full overflow-hidden rounded-md bg-slate-200"
        role="progressbar"
        aria-label="Avanzamento"
      >
        <div className="progress-bar-indeterminate h-full w-2/5 rounded-md bg-blue-700" />
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="h-3 w-full overflow-hidden rounded-md bg-slate-200"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-md bg-blue-700 transition-[width] duration-300 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
