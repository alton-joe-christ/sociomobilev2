"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/Button";
import { LogOutIcon, BellIcon } from "@/components/icons";

export default function SettingsPage() {
  const { userData, signOut } = useAuth();
  const router = useRouter();

  if (!userData) return null;

  return (
    <div className="pwa-page px-4 pb-[calc(var(--bottom-nav)+var(--safe-bottom)+96px)] pt-5 animate-fade-in space-y-4">

      {/* Developer Tools */}
      <div className="card p-4">
        <h2 className="text-[15px] font-extrabold mb-3">Developer Tools</h2>
        <Button
          variant="outline"
          fullWidth
          onClick={() => router.push("/profile/settings/diagnostics")}
          leftIcon={<BellIcon size={16} />}
        >
          Test Notifications
        </Button>
        <p className="text-[11px] text-gray-500 mt-2">
          Diagnose push permission, subscription state, and send a self-test notification.
        </p>
      </div>

      {/* Account Actions */}
      <div className="card p-4">
        <h2 className="text-[15px] font-extrabold mb-3">Account</h2>
        <Button
          variant="danger"
          fullWidth
          onClick={async () => {
            await signOut();
            router.replace("/auth");
          }}
          leftIcon={<LogOutIcon size={16} />}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
