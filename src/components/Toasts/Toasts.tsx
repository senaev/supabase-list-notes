import "./Toasts.css";

import { Modal } from "../Modal/Modal";

type ToastsProps = {
  errors: string[];
  infoMessages: string[];
  onCloseError: (index: number) => void;
  onCloseInfoMessage: (index: number) => void;
};

function InfoToast({
  index,
  message,
  onClose,
}: {
  index: number;
  message: string;
  onClose: (index: number) => void;
}) {
  return (
    <div className="Toasts__toast Toasts__toastInfo" role="status">
      <div className="Toasts__message">{message}</div>
      <button
        aria-label={`Dismiss info ${index + 1}`}
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

/**
 * Errors render in a centered Modal instead of a corner toast: a corner
 * toast has no cap on its height and no way to scroll it, so a long error
 * message (e.g. a raw sync/Supabase error, see NotePage.tsx) could grow
 * past the visible viewport on mobile with no way to read the rest of it.
 * Modal's panel already caps height at 80vh and scrolls internally
 * (see src/components/Modal/Modal.css), so long errors stay fully
 * readable and dismissible.
 */
function ErrorModal({
  index,
  message,
  onClose,
}: {
  index: number;
  message: string;
  onClose: (index: number) => void;
}) {
  return (
    <Modal
      ariaLabel="Error"
      onClose={() => {
        onClose(index);
      }}
    >
      <div className="Toasts__errorModal" role="alert">
        <div className="Toasts__message">{message}</div>
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
    </Modal>
  );
}

export function Toasts({
  errors,
  infoMessages,
  onCloseError,
  onCloseInfoMessage,
}: ToastsProps) {
  return (
    <>
      {errors.map((error, index) => (
        <ErrorModal
          key={`error_${error}_${index}`}
          index={index}
          message={error}
          onClose={onCloseError}
        />
      ))}
      {infoMessages.length > 0 && (
        <div className="Toasts" aria-live="polite" aria-label="Notifications">
          {infoMessages.map((message, index) => (
            <InfoToast
              key={`info_${message}_${index}`}
              index={index}
              message={message}
              onClose={onCloseInfoMessage}
            />
          ))}
        </div>
      )}
    </>
  );
}
