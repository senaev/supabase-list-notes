import './ReplicationStatusIndicator.css';

export type ReplicationStatus = {
    state: 'local-only' | 'initializing' | 'syncing' | 'idle' | 'error';
    message?: string;
};

export function ReplicationStatusIndicator({
    status,
}: {
    status: ReplicationStatus;
}) {
    let label = 'Live';

    if (status.state === 'local-only') {
        label = 'Local only';
    } else if (status.state === 'initializing') {
        label = 'Connecting';
    } else if (status.state === 'syncing') {
        label = 'Syncing';
    } else if (status.state === 'error') {
        label = 'Sync error';
    }

    return <span
        className={`ReplicationStatusIndicator ReplicationStatusIndicator--${status.state}`}
        title={status.message}
    >
        {label}
    </span>;
}
