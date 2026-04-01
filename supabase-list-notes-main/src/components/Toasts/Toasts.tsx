import "./Toasts.css";

import classNames from "classnames";

type ToastType = "error" | "info";

type ToastsProps = {
  errors: string[];
  infoMessages: string[];
  onCloseError: (index: number) => void;
  onCloseInfoMessage: (index: number) => void;
};

function Toast({
  index,
  message,
  type,
  onClose,
}: {
  index: number;
  message: string;
  type: ToastType;
  onClose: (index: number) => void;
}) {
  return (
    <div
      className={classNames("Toasts__toast", {
        Toasts__toastError: type === "error",
        Toasts__toastInfo: type === "info",
      })}
      role={type === "error" ? "alert" : "status"}
    >
      <div className="Toasts__message">{message}</div>
      <button
        aria-label={`Dismiss ${type} ${index + 1}`}
        className="Toasts__close"
        onClick={() => {
          onClose(index);
        }}
        type="button"
      >
        Close
      </button>
    </div>
  );
}

export function Toasts({
  errors,
  infoMessages,
  onCloseError,
  onCloseInfoMessage,
}: ToastsProps) {
  if (errors.length === 0 && infoMessages.length === 0) {
    return null;
  }

  return (
    <div className="Toasts" aria-live="polite" aria-label="Notifications">
      {errors.map((error, index) => (
        <Toast
          key={`error_${error}_${index}`}
          index={index}
          message={error}
          type="error"
          onClose={onCloseError}
        />
      ))}
      {infoMessages.map((message, index) => (
        <Toast
          key={`info_${message}_${index}`}
          index={index}
          message={message}
          type="info"
          onClose={onCloseInfoMessage}
        />
      ))}
    </div>
  );
}
