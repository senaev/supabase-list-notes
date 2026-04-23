import { useNavigate } from 'react-router-dom';

import { useNotesListContext } from '../../contexts/NotesListContext';

export function useCreateNewNote() {
    const notesList = useNotesListContext();
    const navigate = useNavigate();

    return async () => {
        // TODO: handle errors and show error message to user
        const { id } = await notesList.createNewNote();

        navigate(`/${id}`);
    };
}
