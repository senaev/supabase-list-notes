import { createContext, PropsWithChildren, useContext, useRef, useState } from 'react';

import {
    SUPABASE_CONTROLLER_STATUS_INITIALIZATION,
    SupabaseController,
    SupabaseControllerStatus,
} from '../controllers/SupabaseController';

const SupabaseClientContext = createContext<SupabaseControllerStatus>(
    SUPABASE_CONTROLLER_STATUS_INITIALIZATION
);

SupabaseClientContext.displayName = 'SupabaseClientContext';

export function SupabaseClientContextProvider({ children }: PropsWithChildren) {
    const [, setVer] = useState<number>(0);

    const ref = useRef<SupabaseController | null>(null);

    // eslint-disable-next-line react-hooks/refs -- intentional lazy useRef init (survives re-renders without useMemo's non-guaranteed memoization)
    if (!ref.current) {
        ref.current = new SupabaseController({
            onChange: () => {
                setVer((prev) => prev + 1);
            },
        });
    }

    return (
        // eslint-disable-next-line react-hooks/refs -- see justification above; ref.current is guaranteed set by this point
        <SupabaseClientContext.Provider value={ref.current.status}>
            {children}
        </SupabaseClientContext.Provider>
    );
}

export const useSupabaseClientContext = (): SupabaseControllerStatus =>
    useContext(SupabaseClientContext);
