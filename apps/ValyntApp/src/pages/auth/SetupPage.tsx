import { useNavigate } from "react-router-dom";
import { SetupWizard, type SetupData } from "@/features/onboarding";

export function SetupPage() {
  const navigate = useNavigate();

  const handleComplete = (data: SetupData) => {
    // Store setup data (would typically save to backend/localStorage)
    console.log("Setup complete:", data);
    
    // Navigate to main app
    navigate("/app");
  };

  return <SetupWizard onComplete={handleComplete} />;
}

export default SetupPage;
