import { PropsWithChildren, createContext, useContext, useState } from 'react';
import { noop } from 'senaev-utils/src/utils/Function/noop';

import { Toasts } from '../components/Toasts/Toasts';

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

export const ToastsContext = createContext<ToastsContextType>(ToastsContextDefaultValue);
ToastsContext.displayName = 'ToastsContext';

export function ToastsContextProvider({ children }: PropsWithChildren) {
    const [errors, setErrors] = useState<string[]>([]);
    const [infoMessages, setInfoMessages] = useState<string[]>([]);

    function clearErrors() {
        setErrors([]);
    }

    function hideInfoMessage(index: number) {
        setInfoMessages((current) =>
            current.filter((_, currentInfoIndex) => currentInfoIndex !== index)
        );
    }

    return (
        <ToastsContext.Provider
            value={{
                showError: (error) => {
                    // eslint-disable-next-line no-console -- surface errors in devtools in addition to the UI toast
                    console.error(error);
                    setErrors((current) => [...current, error]);
                },
                showInfoMessage: (message) => {
                    // eslint-disable-next-line no-console -- surface info messages in devtools in addition to the UI toast
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

export const useToastsContext = () => useContext(ToastsContext);
