export interface ChallengeCardProps { title?: string; description?: string; className?: string; }
export function ChallengeCard({ title, description, className }: ChallengeCardProps) {
  return <div className={className}><h3>{title}</h3><p>{description}</p></div>;
}
export default ChallengeCard;
