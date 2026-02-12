export interface HumanCheckpointProps { title?: string; onApprove?: () => void; onReject?: () => void; className?: string; }
export function HumanCheckpoint({ title, onApprove, onReject, className }: HumanCheckpointProps) {
  return <div className={className}><h3>{title}</h3><button onClick={onApprove}>Approve</button><button onClick={onReject}>Reject</button></div>;
}
export default HumanCheckpoint;
