import "./Toasts.css";

type ToastsProps = {
  errors: string[];
  onClose: (index: number) => void;
};

export function Toasts({ errors, onClose }: ToastsProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="Toasts" aria-live="polite" aria-label="Error notifications">
      {errors.map((error, index) => (
        <div className="Toasts__toast" key={`${error}-${index}`} role="alert">
          <div className="Toasts__message">{error}</div>
          <button
            aria-label={`Dismiss error ${index + 1}`}
            className="Toasts__close"
            onClick={() => {
              onClose(index);
            }}
            type="button"
          >
            Close
          </button>
        </div>
      ))}
    </div>
  );
}
