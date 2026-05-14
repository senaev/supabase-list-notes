import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';

export type PendingFocus = {
    inputElementId: string;
    selectionStart: number;
    selectionEnd: number;
};

export type PendingFocusSignalValue = PendingFocus | null;

export const PENDING_FOCUS_SIGNAL = new Signal(null as PendingFocusSignalValue, deepEqual);
