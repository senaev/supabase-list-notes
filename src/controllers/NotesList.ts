import { NotesListTable } from "../tables/NotesListTable";

export type NoteRecord = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  // TODO: automatically update these counts when note items are changed
  items_count: number;
  open_items_count: number;
};

export class NotesList {
  public items: NoteRecord[] | undefined = undefined;

  constructor(
    private readonly params: {
      notesListTable: NotesListTable;
      onChange: () => void;
      showError: (message: string) => void;
    },
  ) {
    this.params.notesListTable
      .readAll()
      .then((data) => {
        this.items = data.map((item) => ({
          id: item.id,
          title: item.title,
          created_at: item.created_at,
          updated_at: item.updated_at,
          items_count: item.items_count,
          open_items_count: item.open_items_count,
        }));
        this.params.onChange();
      })
      .catch((err) => {
        this.params.showError(`Failed to load notes: ${err.message}`);
      });
  }

  public async createNewNote(): Promise<NoteRecord> {
    const newNote = await this.params.notesListTable.create({
      id: crypto.randomUUID(),
      title: "",
    });

    this.items = [
      // TODO: remove workaround after fixing items persistence
      ...this.items!,
      {
        ...newNote,
        items_count: 0,
        open_items_count: 0,
      },
    ];

    return {
      ...newNote,
      items_count: 0,
      open_items_count: 0,
    };
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
