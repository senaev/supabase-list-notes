import './Toasts.css';

import { Fragment } from 'react';

import { Modal } from '../Modal/Modal';

type ToastsProps = {
    errors: string[];
    infoMessages: string[];
    onClearErrors: VoidFunction;
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
        <div className={'Toasts__toast Toasts__toastInfo'} role={'status'}>
            <div className={'Toasts__message'}>{message}</div>
            <button
                aria-label={`Dismiss info ${index + 1}`}
                className={'Toasts__close'}
                onClick={() => {
                    onClose(index);
                }}
                type={'button'}
            >
                {'Close'}
            </button>
        </div>
    );
}

/**
 * Errors render in a single centered Modal instead of a corner toast: a
 * corner toast has no cap on its height and no way to scroll it, so a long
 * error message (e.g. a raw sync/Supabase error, see NotePage.tsx) could
 * grow past the visible viewport on mobile with no way to read the rest of
 * it. Modal's panel already caps height at 80vh and scrolls internally
 * (see src/components/Modal/Modal.css), so long errors stay fully readable
 * and dismissible.
 *
 * All currently pending errors stack into this one modal (separated by
 * <hr/>) rather than one modal per error - a flaky sync connection can
 * legitimately produce a fresh error every few seconds (RxDB retries
 * indefinitely and reports every attempt), which would otherwise pop a new
 * modal on top of the last one the user hasn't even read yet. One "Close"
 * dismisses all of them at once.
 */
function ErrorsModal({ errors, onClose }: { errors: string[]; onClose: VoidFunction }) {
    return (
        <Modal ariaLabel={'Error'} onClose={onClose}>
            <div className={'Toasts__errorModal'} role={'alert'}>
                <button
                    aria-label={'Dismiss errors'}
                    className={'Toasts__close'}
                    onClick={onClose}
                    type={'button'}
                >
                    {'Close'}
                </button>
                {errors.map((error, index) => (
                    <Fragment key={`${index}_${error}`}>
                        {index > 0 && <hr className={'Toasts__errorDivider'} />}
                        <div className={'Toasts__message'}>{error}</div>
                    </Fragment>
                ))}
            </div>
        </Modal>
    );
}

export function Toasts({ errors, infoMessages, onClearErrors, onCloseInfoMessage }: ToastsProps) {
    return (
        <>
            {errors.length > 0 && <ErrorsModal errors={errors} onClose={onClearErrors} />}
            {infoMessages.length > 0 && (
                <div className={'Toasts'} aria-live={'polite'} aria-label={'Notifications'}>
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
