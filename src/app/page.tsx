import { Dashboard } from "../features/dashboard";
import { GpuQuotaSection } from "../features/gpu-quota";
import { ImageQuotaSection } from "../features/image-quota";
import { LocalAgentSection } from "../features/local-agent";
import { VideoQuotaSection } from "../features/video-quota";
import { VoiceQuotaSection } from "../features/voice-quota";

export default function HomePage() {
  return (
    <Dashboard>
      <VideoQuotaSection />
      <ImageQuotaSection />
      <LocalAgentSection />
      <GpuQuotaSection />
      <VoiceQuotaSection />
    </Dashboard>
  );
}
