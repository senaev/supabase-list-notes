const LOCAL_STORAGE_KEY = 'last-selected-item-type';

/**
 * The type filter (see ItemTypesNav) the user had open the last time they
 * used the app, or null if none was ever saved. NotePage reads this once on
 * mount so a fresh page load restores the same view instead of always
 * defaulting to "show all types".
 */
export function getLastSelectedItemType(): string | null {
    return localStorage.getItem(LOCAL_STORAGE_KEY);
}

/**
 * Persists the given type as "the last page the user saw" (see
 * getLastSelectedItemType). Called from ItemTypesNav's pill onClick.
 */
export function setLastSelectedItemType(type: string): void {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, type);
    } catch (error) {
        // Storage can be unavailable (Safari private mode, quota). The type
        // filter still works this session; it just won't be restored on the
        // next load, which is strictly better than failing to render the list.
        // eslint-disable-next-line no-console -- surface storage failures in devtools
        console.error('Failed to persist the last selected item type:', error);
    }
}

/**
 * Clears the saved "last page the user saw" so the next load defaults to
 * "show all types" instead of restoring a filter. Called from PageHeader's
 * home button onClick.
 */
export function clearLastSelectedItemType(): void {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
}
