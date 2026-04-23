import { LocalDbFacadeStatus, useLocalDbFacadeStatus } from '../../contexts/LocalDbFacadeContext';
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
    localDbStatus,
    supabaseControllerStatus,
}: {
    localDbStatus: LocalDbFacadeStatus;
    supabaseControllerStatus: SupabaseControllerStatus;
}): ConnectionStatus {
    if (localDbStatus === 'loading') {
        return 'loadingLocalDb';
    }

    if (localDbStatus === 'error') {
        return 'error';
    }

    if (supabaseControllerStatus.status === 'ready') {
        return 'fullReady';
    }

    return 'idle';
}

export function ConnectionStatusIndicator() {
    const supabaseControllerStatus = useSupabaseControllerStatus();
    const localDbStatus = useLocalDbFacadeStatus();

    const connectionStatus: ConnectionStatus = getConnectionStatusByDbStatuses({
        localDbStatus,
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
