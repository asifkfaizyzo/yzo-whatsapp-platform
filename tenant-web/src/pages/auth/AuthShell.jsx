// tenant-web/src/pages/auth/AuthShell.jsx (do not remove this comment)
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthThemeProvider } from "../../theme/AuthThemeContext";
import AuthLeftPanel from "./AuthLeftPanel";
import AuthRightPanel from "./AuthRightPanel";
import Login from "./Login";
import SignupPage from "./Signup/SignupPage";

export default function AuthShell({ mode: initialModeProp }) {
  const navigate = useNavigate();
  const location = useLocation();

  const determineMode = () => {
    if (initialModeProp) return initialModeProp;
    if (location.pathname.startsWith("/signup")) return "signup";
    return "login";
  };

  const [activeMode, setActiveMode] = useState(determineMode);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Sync with browser back/forward
  useEffect(() => {
    const routeMode = location.pathname.startsWith("/signup")
      ? "signup"
      : "login";
    if (routeMode !== activeMode) {
      setActiveMode(routeMode);
    }
  }, [location.pathname]);

  // Smooth mode transition
  const handleSwitchMode = (targetMode) => {
    if (targetMode === activeMode || isTransitioning) return;
    setIsTransitioning(true);

    const targetPath = targetMode === "signup" ? "/signup" : "/login";

    setTimeout(() => {
      setActiveMode(targetMode);
      navigate(targetPath, { replace: true });
      setIsTransitioning(false);
    }, 200);
  };

  // Render the appropriate form based on active mode
  const renderForm = () => {
    if (activeMode === "login") {
      return <Login onSwitchMode={() => handleSwitchMode("signup")} />;
    }
    return <SignupPage onSwitchMode={() => handleSwitchMode("login")} />;
  };

  return (
    <AuthThemeProvider>
      {/*
        LAYOUT CONTRACT (parent-level only):
        ─────────────────────────────────────
        • h-screen + overflow-hidden on OUTER wrapper → the page never scrolls.
        • Left panel: fixed width (5/12), full viewport height.
        • Right panel: fills the rest, full viewport height.
        • Each panel is INTERNALLY responsible for its own content fitting.
        • No child ever causes the PAGE to scroll.
      */}
      <div className="h-screen w-screen overflow-hidden bg-[#f8fafc] flex flex-col lg:flex-row font-sans">
        <AuthLeftPanel />
        <AuthRightPanel
          activeMode={activeMode}
          isTransitioning={isTransitioning}
        >
          {renderForm()}
        </AuthRightPanel>
      </div>
    </AuthThemeProvider>
  );
}