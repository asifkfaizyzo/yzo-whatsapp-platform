import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function FacebookLoginButton({ onSuccess, onError, disabled, text = "Continue with Facebook" }) {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If already loaded, just return
    if (window.FB) {
      return;
    }

    // Initialize the SDK if not already done
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: import.meta.env.VITE_META_APP_ID,
        cookie: true,
        xfbml: true,
        version: "v20.0",
      });
    };

    // Load the SDK asynchronously
    (function (d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) { return; }
      js = d.createElement(s); js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      
      // Handle ad-blockers blocking the script
      js.onerror = () => {
        console.error("Facebook SDK failed to load (possible ad-blocker).");
      };
      
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
  }, []);

  const handleLogin = () => {
    if (!window.FB) {
      onError("Unable to load Facebook Login. Please disable ad-blockers or log in with email.");
      return;
    }

    setIsLoading(true);

    window.FB.login(
      (response) => {
        if (response.authResponse) {
          onSuccess(response.authResponse.accessToken);
        } else {
          setIsLoading(false);
          onError("Facebook login was cancelled or failed.");
        }
      },
      { scope: "public_profile,email" }
    );
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={disabled || isLoading}
      className="flex items-center justify-center w-[340px] h-[40px] rounded-full border border-[#dadce0] bg-white hover:bg-[#f8f9fa] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-[#3c4043]" />
      ) : (
        <>
          <img src="https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg" alt="Facebook" className="w-[18px] h-[18px] mr-3" />
          <span className="text-[#3c4043] font-medium text-[14px] font-roboto tracking-[0.25px]">{text}</span>
        </>
      )}
    </button>
  );
}
