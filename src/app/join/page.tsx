import {
  landingMetadata,
  WaitlistLanding,
  type LandingSearchParams,
} from "./waitlist-landing";

export const metadata = landingMetadata;

export default function JoinPage({
  searchParams,
}: {
  searchParams: LandingSearchParams;
}) {
  return <WaitlistLanding searchParams={searchParams} />;
}
