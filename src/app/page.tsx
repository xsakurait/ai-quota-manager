import { Dashboard } from "../features/dashboard";
import { GpuQuotaSection } from "../features/gpu-quota";
import { LocalAgentSection } from "../features/local-agent";
import { VideoQuotaSection } from "../features/video-quota";
import { VoiceQuotaSection } from "../features/voice-quota";

export default function HomePage() {
  return (
    <Dashboard>
      <VideoQuotaSection />
      <LocalAgentSection />
      <GpuQuotaSection />
      <VoiceQuotaSection />
    </Dashboard>
  );
}
