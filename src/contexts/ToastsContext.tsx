import { PropsWithChildren, createContext, useContext, useState } from "react";
import { Toasts } from "../components/Toasts/Toasts";
import { noop } from "../utils/noop";

type ToastsContextType = {
  showError: (error: string) => void;
  showInfoMessage: (message: string) => void;
  /** Dismisses every currently shown error at once - see Toasts, which
   * stacks all of them into a single modal rather than one per error. */
  clearErrors: VoidFunction;
  hideInfoMessage: (messageIndex: number) => void;
  errors: string[];
};

const ToastsContextDefaultValue: ToastsContextType = {
  showError: noop,
  showInfoMessage: noop,
  clearErrors: noop,
  hideInfoMessage: noop,
  errors: [],
};

export const ToastsContext = createContext<ToastsContextType>(
  ToastsContextDefaultValue,
);
ToastsContext.displayName = "ToastsContext";

export function ToastsContextProvider({ children }: PropsWithChildren) {
  const [errors, setErrors] = useState<string[]>([]);
  const [infoMessages, setInfoMessages] = useState<string[]>([]);

  function clearErrors() {
    setErrors([]);
  }

  function hideInfoMessage(index: number) {
    setInfoMessages((current) =>
      current.filter((_, currentInfoIndex) => currentInfoIndex !== index),
    );
  }

  return (
    <ToastsContext.Provider
      value={{
        showError: (error) => {
          console.error(error);
          setErrors((current) => [...current, error]);
        },
        showInfoMessage: (message) => {
          console.info(message);
          setInfoMessages((current) => [...current, message]);
        },
        clearErrors,
        hideInfoMessage,
        errors,
      }}
    >
      {children}
      <Toasts
        errors={errors}
        infoMessages={infoMessages}
        onClearErrors={clearErrors}
        onCloseInfoMessage={hideInfoMessage}
      />
    </ToastsContext.Provider>
  );
}

export const useToastsContext = () => {
  return useContext(ToastsContext);
};
