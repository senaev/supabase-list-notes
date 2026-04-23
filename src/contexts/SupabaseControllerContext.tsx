import {
    createContext,
    PropsWithChildren,
    useContext,
} from 'react';
import { useSignal } from 'senaev-utils/src/utils/Signal/useSignal';

import {
    SupabaseController,
    SupabaseControllerStatus,
} from '../controllers/SupabaseController';

const SupabaseControllerStatusContext = createContext<SupabaseControllerStatus | undefined>(undefined);

SupabaseControllerStatusContext.displayName = 'SupabaseControllerStatusContext';

export function SupabaseControllerStatusContextProvider({ children, supabaseController }: PropsWithChildren & {
    supabaseController: SupabaseController;
}) {
    const status = useSignal(supabaseController.statusSignal);

    return <SupabaseControllerStatusContext.Provider value={status}>
        {children}
    </SupabaseControllerStatusContext.Provider>;
}

export const useSupabaseControllerStatus = (): SupabaseControllerStatus => {
    const status = useContext(SupabaseControllerStatusContext);

    if (!status) {
        throw new Error('useSupabaseControllerStatus must be used within a SupabaseClientContextProvider');
    }

    return status;
};
