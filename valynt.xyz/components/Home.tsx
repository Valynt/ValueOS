import { Hero } from './Hero';
import { TrustedBy } from './TrustedBy';
import { Stats } from './Stats';
import { Problem } from './Problem';
import { Solution } from './Solution';
import { HowItWorks } from './HowItWorks';
import { UseCases } from './UseCases';
import { SocialProof } from './SocialProof';
import { FAQ } from './FAQ';
import { CTA } from './CTA';
import { MiniCTA } from './MiniCTA';

export function Home() {
  return (
    <>
      <Hero />
      <TrustedBy />
      <Stats />
      <Problem />
      <MiniCTA text="See How VOS Can Help You" />
      <Solution />
      <MiniCTA text="Start Your Value Transformation" />
      <HowItWorks />
      <UseCases />
      <SocialProof />
      <FAQ />
      <CTA />
    </>
  );
}
