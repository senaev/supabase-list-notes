import { Item } from '../sync/types';

/**
 * Every distinct type used by any of `items`, sorted with the most common
 * type first. Ties (equal counts) are broken alphabetically, so the order
 * is fully deterministic instead of depending on which item happened to
 * appear first in the array.
 *
 * Single source of truth for type ordering so every place that lists types
 * - the top nav pills (ItemTypesNav) and the per-item type picker (via
 * NotePage's `existingTypes`) - shows them in the same order.
 */
export function getTypesByPopularity(items: Item[]): string[] {
    const countByType = new Map<string, number>();

    for (const item of items) {
        countByType.set(item.type, (countByType.get(item.type) ?? 0) + 1);
    }

    return Array.from(countByType.keys()).sort((a, b) => {
        const countDiff = (countByType.get(b) ?? 0) - (countByType.get(a) ?? 0);

        return countDiff !== 0 ? countDiff : a.localeCompare(b);
    });
}
