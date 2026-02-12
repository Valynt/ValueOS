import { useNavigate } from "react-router-dom";
import { SetupWizard, type SetupData } from "@/features/onboarding";
import { logger } from "../../lib/logger";

export function SetupPage() {
  const navigate = useNavigate();

  const handleComplete = (data: SetupData) => {
    // Store setup data (would typically save to backend/localStorage)
    logger.info("Setup complete:", data);
    
    // Navigate to main app
    navigate("/app");
  };

  return <SetupWizard onComplete={handleComplete} />;
}

export default SetupPage;
