import {
    createContext,
    PropsWithChildren,
    useContext,
    useRef,
    useState,
} from 'react';

import {
    SupabaseController,
} from '../controllers/SupabaseController';

const SupabaseControllerContext = createContext<SupabaseController | undefined>(undefined);

SupabaseControllerContext.displayName = 'SupabaseControllerContext';

export function SupabaseControllerContextProvider({ children }: PropsWithChildren) {
    const [
        _ver,
        setVer,
    ] = useState<number>(0);

    const ref = useRef<SupabaseController | null>(null);

    if (!ref.current) {
        ref.current = new SupabaseController({
            onChange: () => {
                setVer((prev) => prev + 1);
            },
        });
    }

    return <SupabaseControllerContext.Provider value={ref.current}>
        {children}
    </SupabaseControllerContext.Provider>;
}

export const useSupabaseController = (): SupabaseController => {
    const controller = useContext(SupabaseControllerContext);

    if (!controller) {
        throw new Error('useSupabaseController must be used within a SupabaseClientContextProvider');
    }

    return controller;
};
