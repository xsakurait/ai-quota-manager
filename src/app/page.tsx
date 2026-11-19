import { Dashboard } from "../features/dashboard";
import { LocalAgentSection } from "../features/local-agent";
import { VideoQuotaSection } from "../features/video-quota";

export default function HomePage() {
  return (
    <Dashboard>
      <VideoQuotaSection />
      <LocalAgentSection />
    </Dashboard>
  );
}
