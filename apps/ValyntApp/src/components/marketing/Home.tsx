import { CTA } from "./CTA";
import { FAQ } from "./FAQ";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { MiniCTA } from "./MiniCTA";
import { Problem } from "./Problem";
import { SocialProof } from "./SocialProof";
import { Solution } from "./Solution";
import { Stats } from "./Stats";
import { TrustedBy } from "./TrustedBy";
import { UseCases } from "./UseCases";

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
