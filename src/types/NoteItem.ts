export type NoteItem = {
  id: number;
  list_id: number;
  title: string;
  position: number;
  created: string;
  updated: string;
  update_index: number;
  check_time: string | null;
  // TODO: finish persisting logic and local/remote synchronization
  persisted: boolean;
  child: boolean;
};
