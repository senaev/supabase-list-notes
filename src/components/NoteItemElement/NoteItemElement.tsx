import './NoteItemElement.css';

import classNames from 'classnames';
import { KeyboardEvent, SyntheticEvent } from 'react';

import { DEBUG_ENABLED } from '../../const/DEBUG_ENABLED';
import { Item } from '../../sync/types';
import { ItemTypePicker } from '../ItemTypePicker/ItemTypePicker';

export function NoteItemElement({
    item,
    toggleChecked,
    onChange,
    onChangeType,
    onFocus,
    onKeyDown,
    onRemove,
    onTextSelectionChange,
    readonlyText,
    existingTypes,
    truncateType,
    activeEditorEmojis,
}: {
    item: Item;
    toggleChecked: (checked: boolean) => void;
    onChange: (value: string) => void;
    onChangeType: (type: string) => void;
    onFocus: VoidFunction;
    onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
    onRemove: VoidFunction;
    readonlyText: boolean;
    onTextSelectionChange: (event: SyntheticEvent<HTMLTextAreaElement>) => void;
    existingTypes: string[];
    // Shorten the type pill to a few characters + "…" (active type filter).
    truncateType?: boolean;
    // Animal avatars of the other tabs/people currently on this item (see
    // ActiveItemsPresenceStore). Undefined when nobody else is here, which is
    // the overwhelmingly common case.
    activeEditorEmojis?: string[];
}) {
    return (
        <div
            className={classNames('NoteItemElement', {
                NoteItemElement_isChecked: Boolean(item.checked_at),
            })}
        >
            <label className={'NoteItemElement__checkboxLabel'}>
                <input
                    aria-label={`Mark ${item.title || 'item'} as checked`}
                    checked={Boolean(item.checked_at)}
                    className={'NoteItemElement__checkbox'}
                    onChange={(event) => {
                        toggleChecked(event.target.checked);
                    }}
                    readOnly={readonlyText}
                    type={'checkbox'}
                />
            </label>
            <label className={'NoteItemElement__textareaLabel'}>
                {readonlyText ? (
                    <div className={'NoteItemElement__input'}>{item.title}</div>
                ) : (
                    <textarea
                        id={`input-${item.id}`}
                        className={'NoteItemElement__input'}
                        onChange={(event) => {
                            onChange(event.currentTarget.value);
                        }}
                        onFocus={onFocus}
                        onSelect={onTextSelectionChange}
                        onKeyDown={onKeyDown}
                        rows={1}
                        value={item.title}
                    />
                )}
            </label>
            {DEBUG_ENABLED && (
                <span
                    style={{
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        gap: '2px',
                        whiteSpace: 'nowrap',
                    }}
                >
                    <span
                        style={{
                            color: '#98FFAE',
                        }}
                    >
                        {'id=['}
                        {item.id.slice(0, 8)}
                        {']'}
                    </span>
                    <span
                        style={{
                            color: '#C1FF98',
                        }}
                    >
                        {'updated=['}
                        {new Date(item.modified_at).getTime()}
                        {']'}
                    </span>
                </span>
            )}
            {activeEditorEmojis && activeEditorEmojis.length > 0 && (
                <span
                    aria-label={`Also being edited by ${activeEditorEmojis.join(', ')}`}
                    className={'NoteItemElement__activeEditors'}
                    title={'Being edited right now'}
                >
                    {activeEditorEmojis.join('')}
                </span>
            )}
            <ItemTypePicker
                currentType={item.type}
                existingTypes={existingTypes}
                onSelect={onChangeType}
                truncateTrigger={truncateType}
            />
            <button
                aria-label={`Remove ${item.title || 'item'}`}
                className={'NoteItemElement__remove'}
                onClick={onRemove}
                type={'button'}
            >
                <div className={'NoteItemElement__remove__visual'} />
            </button>
        </div>
    );
}
