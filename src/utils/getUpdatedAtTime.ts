import { UnixTimeMs } from 'senaev-utils/src/types/Time/UnixTimeMs';

export function getUpdatedAtTime(note: { updated_at: string }): UnixTimeMs {
    return new Date(note.updated_at).getTime();
}
