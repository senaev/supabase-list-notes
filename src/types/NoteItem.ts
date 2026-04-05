export type NoteItem = {
  id: string;
  note_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  // TODO: finish persisting logic and local/remote synchronization
  persisted: boolean;
  is_child: boolean;
};
