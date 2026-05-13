export type NoteItem = {
    id: string;
    note_id: string;
    title: string;
    position: number;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
    is_child: boolean;
    _modified: string;
};
