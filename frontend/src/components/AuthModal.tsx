"use client";

import { useAuth } from "@/context/AuthContext";
import { Modal } from "@/components/ui/Modal";
import SignInForm from "@/components/auth/SignInForm";

/** Sign-in dialog for people already inside the app, for example a customer switching to an admin account. */
export default function AuthModal() {
  const { modal, closeAuthModal } = useAuth();

  return (
    <Modal open={modal !== "closed"} onClose={closeAuthModal} title={modal === "register" ? "Create account" : "Sign in"}>
      <div className="p-5">
        {/* key resets the form each time the dialog opens in a different mode */}
        <SignInForm key={modal} initialMode={modal === "register" ? "register" : "login"} />
      </div>
    </Modal>
  );
}
