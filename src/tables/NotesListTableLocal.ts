import { Subscription } from 'rxjs';

import { NoteRecord } from '../controllers/NotesList';
import {
    LocalDbFacade, LocalNoteRow,
} from '../localDb/LocalDbFacade';
import { SplitCommaAndTrim } from '../utils/SplitCommaAndTrim';

const _TABLE_COLUMNS = 'id, title, created_at, modified_at';

type TableColumns = SplitCommaAndTrim<typeof _TABLE_COLUMNS>;

function toNoteRecord(row: LocalNoteRow): Pick<NoteRecord, TableColumns> {
    return {
        id: row.id,
        title: row.title,
        created_at: row.created_at,
        modified_at: row._modified,
    };
}

export class NotesListTableLocal {
    public constructor(private readonly localDbFacade: LocalDbFacade) {}

    public async create({
        id,
    title,
    }: {
        id: string;
        title: string;
    }): Promise<Pick<NoteRecord, TableColumns>> {
        const now = new Date().toISOString();
        const localRow: LocalNoteRow = {
            id,
            title,
            created_at: now,
            _modified: now,
        };

        await this.localDbFacade.notes_temp.put(localRow);

        return toNoteRecord(localRow);
    }

    public observeAll(onChange: (notes: Pick<NoteRecord, TableColumns>[]) => void): Promise<Subscription> {
        return this.localDbFacade.notes_temp.observeAll((notes) => {
            onChange(notes.map(toNoteRecord));
        });
    }

    public async update(
        id: string,
        updates: {
            title?: string;
        }
    ): Promise<void> {
        const localRow = await this.localDbFacade.notes_temp.get(id);

        if (!localRow) {
            throw new Error(`NotesListTable.update(${id}) error: note not found`);
        }

        const updatedLocalRow: LocalNoteRow = {
            ...localRow,
            ...updates,
            _modified: new Date().toISOString(),
        };

        await this.localDbFacade.notes_temp.put(updatedLocalRow);
    }

    public async delete(id: string): Promise<void> {
        await this.localDbFacade.notes_temp.remove(id);
    }
}
