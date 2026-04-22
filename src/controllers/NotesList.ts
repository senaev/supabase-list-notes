import { NotesStore } from "./NotesStore";

export type NoteRecord = {
  id: string;
  title: string;
  created_at: string;
  modified_at: string;
};

export class NotesList {
  public items: NoteRecord[] | undefined = undefined;
  private unsubscribeStore: (() => void) | null = null;

  constructor(
    private readonly params: {
      notesStore: NotesStore;
      notesListTable: {
        create: (note: { id: string; title: string }) => Promise<NoteRecord>;
        update: (id: string, updates: { title?: string }) => Promise<void>;
        delete: (id: string) => Promise<void>;
      };
      onChange: () => void;
      showError: (message: string) => void;
    },
  ) {}

  public connect(): void {
    if (this.unsubscribeStore) {
      return;
    }

    this.params.notesStore.connect();
    this.items = this.params.notesStore.getItems();
    this.params.onChange();
    this.unsubscribeStore = this.params.notesStore.subscribe(() => {
      this.items = this.params.notesStore.getItems();
      this.params.onChange();
    });
  }

  public dispose(): void {
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
  }

  public async createNewNote(): Promise<NoteRecord> {
    const newNote = await this.params.notesListTable.create({
      id: crypto.randomUUID(),
      title: "",
    });

    this.items = [
      // TODO: remove workaround after fixing items persistence
      ...this.items!,
      newNote,
    ];

    return newNote;
  }

  public changeTitleLocally(id: string, title: string): void {
    this.items = this.items!.map((item) => {
      if (item.id !== id) {
        return item;
      }

      return { ...item, title };
    });
    this.params.onChange();
  }

  public async persistTitle(id: string, title: string): Promise<void> {
    try {
      await this.params.notesListTable.update(id, { title });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.params.showError(`Failed to update note title: ${message}`);
    }
  }

  public async delete(id: string): Promise<void> {
    const { items } = this;

    if (!items) {
      this.params.showError("Notes are not loaded yet");
      return;
    }

    try {
      this.items = items.filter((item) => item.id !== id);
      this.params.onChange();

      await this.params.notesListTable.delete(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.params.showError(`Failed to delete note: ${message}`);
    }
  }
}
