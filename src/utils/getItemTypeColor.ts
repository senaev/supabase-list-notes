import { CHROME_TAB_GROUP_COLORS } from '../const/CHROME_TAB_GROUP_COLORS';

/**
 * Deterministically maps a type name to one of Chrome's tab group colors
 * (see const/CHROME_TAB_GROUP_COLORS), so the same type string always
 * renders with the same color everywhere, without storing a color
 * anywhere - it's derived purely from a hash of the name.
 */
export function getItemTypeColor(type: string): string {
    let hash = 0;
    for (let i = 0; i < type.length; i++) {
        hash = (hash * 31 + type.charCodeAt(i)) | 0;
    }

    const index = Math.abs(hash) % CHROME_TAB_GROUP_COLORS.length;
    return CHROME_TAB_GROUP_COLORS[index];
}
