import { useEffect, useRef, useState } from "react";
import { env } from "@/config/env";

const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

type GoogleSignInButtonProps = {
  onCredential: (credential: string) => void | Promise<void>;
  onError?: (message: string) => void;
  disabled?: boolean;
};

function loadGsiScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Sign-In is unavailable"));
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Sign-In")), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(script);
  });
}

/**
 * Google Sign-In button (popup / FedCM credential callback only — no One Tap).
 * Renders nothing unless VITE_GOOGLE_CLIENT_ID is set.
 * Never logs or stores the credential locally.
 */
export function GoogleSignInButton({ onCredential, onError, disabled }: GoogleSignInButtonProps) {
  const clientId = env.googleClientId;
  const buttonRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);

  onCredentialRef.current = onCredential;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    (async () => {
      try {
        await loadGsiScript();
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: "popup",
          auto_select: false,
          callback: (response) => {
            const credential = response?.credential;
            if (!credential) {
              onErrorRef.current?.("Google Sign-In did not return a credential.");
              return;
            }
            void onCredentialRef.current(credential);
          },
        });

        buttonRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: buttonRef.current.offsetWidth || 320,
        });
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) {
          onErrorRef.current?.("Unable to load Google Sign-In.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) return null;

  return (
    <div
      className={`w-full min-h-[44px] flex justify-center ${disabled || !ready ? "opacity-70 pointer-events-none" : ""}`}
      aria-busy={!ready}
    >
      <div ref={buttonRef} className="w-full flex justify-center [&>div]:w-full" />
    </div>
  );
}
