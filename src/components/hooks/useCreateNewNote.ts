import { useNavigate } from 'react-router-dom';

import { useNotesListStore } from '../../contexts/NotesListStoreContext';

export function useCreateNewNote() {
    const notesList = useNotesListStore();
    const navigate = useNavigate();

    return async () => {
        // TODO: handle errors and show error message to user
        const { id } = await notesList.createNewNote();

        navigate(`/${id}`);
    };
}
