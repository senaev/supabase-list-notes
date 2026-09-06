import { EllipsisHorizontalCircleIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import { addElementEventListener } from 'senaev-utils/src/utils/DOM/addElementEventListener/addElementEventListener';
import { noop } from 'senaev-utils/src/utils/Function/noop';

import './ContextMenu.css';

export type ContextMenuItem = {
    label: string;
    onSelect: VoidFunction;
    Icon?: React.ComponentType<{ className?: string }>;
};

export function ContextMenu({ items }: { items: ContextMenuItem[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const isMenuVisible = isOpen && items.length > 0;

    // iOS Safari does not focus a button on tap, so an open menu never gets a
    // blur to close it. Watch the pointer instead of relying on focus alone.
    useEffect(() => {
        if (!isMenuVisible) {
            return noop;
        }

        return addElementEventListener({
            element: document.documentElement,
            eventName: 'pointerdown',
            listener: (event) => {
                const root = rootRef.current;

                if (root && !root.contains(event.target as Node | null)) {
                    setIsOpen(false);
                }
            },
        });
    }, [isMenuVisible]);

    return (
        <div
            ref={rootRef}
            className={'ContextMenu__root'}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setIsOpen(false);
                }
            }}
        >
            <button
                type={'button'}
                aria-label={'Open menu'}
                aria-expanded={isMenuVisible}
                className={'ContextMenu__trigger'}
                onClick={() => {
                    setIsOpen((wasOpen) => !wasOpen);
                }}
            >
                <EllipsisHorizontalCircleIcon className={'MainPageHeader__icon'} />
            </button>
            {isMenuVisible ? (
                <div className={'ContextMenu'} role={'menu'}>
                    {items.map((item, i) => (
                        <button
                            key={i}
                            type={'button'}
                            role={'menuitem'}
                            className={'ContextMenu__item'}
                            onClick={() => {
                                item.onSelect();
                                setIsOpen(false);
                            }}
                        >
                            {item.Icon && <item.Icon className={'ContextMenu__itemIcon'} />}{' '}
                            {item.label}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
