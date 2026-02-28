import { useNavigate } from "react-router-dom";

import { logger } from "../../lib/logger";

import { type SetupData, SetupWizard } from "@/features/onboarding";

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
