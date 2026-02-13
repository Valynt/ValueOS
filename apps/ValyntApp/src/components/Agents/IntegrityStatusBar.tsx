export interface IntegrityStatusBarProps { score?: number; className?: string; }
export function IntegrityStatusBar({ score = 0, className }: IntegrityStatusBarProps) {
  return <div className={className} role="progressbar" aria-valuenow={score}>{score}%</div>;
}
export default IntegrityStatusBar;
