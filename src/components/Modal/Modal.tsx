import './Modal.css';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { addElementEventListener } from 'senaev-utils/src/utils/DOM/addElementEventListener/addElementEventListener';

/**
 * Generic centered modal: a dimmed, full-viewport overlay (rendered via a
 * portal into document.body, so it's positioned relative to the window
 * rather than wherever the trigger happens to sit in the page) with a
 * panel centered inside it. Closes on Escape or on clicking the backdrop.
 *
 * Unlike ContextMenu/the old ItemTypePicker dropdown - which anchor a
 * panel under the trigger with `position: absolute` - this always renders
 * in the middle of the viewport, so it can never end up clipped or
 * off-screen when the trigger is near the bottom (or edge) of a
 * scrollable page.
 */
export function Modal({
    onClose,
    children,
    ariaLabel,
}: {
    onClose: VoidFunction;
    children: React.ReactNode;
    ariaLabel?: string;
}) {
    useEffect(
        () =>
            addElementEventListener({
                element: document.documentElement,
                eventName: 'keydown',
                listener: (event) => {
                    if (event.key === 'Escape') {
                        onClose();
                    }
                },
            }),
        [onClose]
    );

    return createPortal(
        <div
            className={'Modal__overlay'}
            onMouseDown={(event) => {
                // Only close when the backdrop itself (not the panel or its
                // contents) is the click target.
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div aria-label={ariaLabel} className={'Modal__panel'} role={'dialog'}>
                {children}
            </div>
        </div>,
        document.body
    );
}
