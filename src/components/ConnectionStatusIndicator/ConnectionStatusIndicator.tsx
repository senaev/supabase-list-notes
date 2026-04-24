import { UsePromiseResult } from 'senaev-utils/src/reactHooks/usePromise';

import {
    useLocalDbFacade,
} from '../../contexts/LocalDbFacadeContext';
import { useSupabaseControllerStatus } from '../../contexts/SupabaseControllerContext';
import { SupabaseControllerStatus } from '../../controllers/SupabaseController';
import './ConnectionStatusIndicator.css';

const CONNECTION_STATUSES = {
    idle: 'Idle',
    loadingLocalDb: 'Loading local DB',
    localOnly: 'Local only',
    syncing: 'Syncing',
    fullReady: 'Full ready',
    error: 'Sync error',
} as const;

export type ConnectionStatus = keyof typeof CONNECTION_STATUSES;

function getConnectionStatusByDbStatuses({
    localDbFacadeContextValue,
    supabaseControllerStatus,
}: {
    localDbFacadeContextValue: UsePromiseResult<unknown>;
    supabaseControllerStatus: SupabaseControllerStatus;
}): ConnectionStatus {
    if (localDbFacadeContextValue === undefined) {
        return 'loadingLocalDb';
    }

    if ('error' in localDbFacadeContextValue) {
        return 'error';
    }

    if (supabaseControllerStatus.status === 'ready') {
        return 'fullReady';
    }

    return 'idle';
}

export function ConnectionStatusIndicator() {
    const supabaseControllerStatus = useSupabaseControllerStatus();
    const localDbFacadeContextValue = useLocalDbFacade();

    const connectionStatus: ConnectionStatus = getConnectionStatusByDbStatuses({
        localDbFacadeContextValue,
        supabaseControllerStatus,
    });

    const label = CONNECTION_STATUSES[connectionStatus];

    return <span
        className={`ConnectionStatusIndicator ConnectionStatusIndicator__${connectionStatus}`}
        title={label}
    >
        {label}
    </span>;
}
