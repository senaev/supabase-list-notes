import "./ReplicationStatusIndicator.css";

export type ReplicationStatus = {
  state: "local-only" | "initializing" | "syncing" | "idle" | "error";
  message?: string;
};

export function ReplicationStatusIndicator({
  status,
}: {
  status: ReplicationStatus;
}) {
  const label =
    status.state === "local-only"
      ? "Local only"
      : status.state === "initializing"
      ? "Connecting"
      : status.state === "syncing"
        ? "Syncing"
        : status.state === "error"
          ? "Sync error"
          : "Live";

  return (
    <span
      className={`ReplicationStatusIndicator ReplicationStatusIndicator--${status.state}`}
      title={status.message}
    >
      {label}
    </span>
  );
}
