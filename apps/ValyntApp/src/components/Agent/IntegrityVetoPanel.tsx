export interface IntegrityVetoPanelProps { violations?: string[]; onOverride?: () => void; className?: string; }
export function IntegrityVetoPanel({ violations = [], onOverride, className }: IntegrityVetoPanelProps) {
  return <div className={className}>{violations.map((v, i) => <p key={i}>{v}</p>)}<button onClick={onOverride}>Override</button></div>;
}
export default IntegrityVetoPanel;
