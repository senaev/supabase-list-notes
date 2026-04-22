import { EllipsisHorizontalCircleIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import './ContextMenu.css';

export type ContextMenuItem = {
    label: string;
    onSelect: VoidFunction;
    Icon?: React.ComponentType<{ className?: string }>;
};

export function ContextMenu({ items }: { items: ContextMenuItem[] }) {
    const [
        isOpen,
        setIsOpen,
    ] = useState(false);

    return <div
        className={'ContextMenu__root'}
        onFocus={() => {
            setIsOpen(true);
        }}
        onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsOpen(false);
            }
        }}
    >
        <button
            type={'button'}
            aria-label={'Open menu'}
            className={'ContextMenu__trigger'}
        >
            <EllipsisHorizontalCircleIcon className={'MainPageHeader__icon'}/>
        </button>
        {isOpen && items.length > 0
            ? <div
                className={'ContextMenu'}
                role={'menu'}
            >
                {items.map((item, i) => <button
                    key={i}
                    type={'button'}
                    role={'menuitem'}
                    className={'ContextMenu__item'}
                    onClick={() => {
                        item.onSelect();
                        setIsOpen(false);
                    }}
                >
                    {item.Icon && <item.Icon className={'ContextMenu__itemIcon'}/>}
                    {' '}
                    {item.label}
                </button>)}
            </div>
            : null}
    </div>;
}
