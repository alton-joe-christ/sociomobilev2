import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import toast from "react-hot-toast";

interface ShareOptions {
  title: string;
  text: string;
  url: string;
}

export async function shareEvent({ title, text, url }: ShareOptions) {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({
        title,
        text,
        url,
        dialogTitle: "Share Event",
      });
    } else if (navigator.share) {
      await navigator.share({
        title,
        text,
        url,
      });
    } else {
      // Fallback: Copy to clipboard
      await navigator.clipboard.writeText(`${title}\n${text}\n${url}`);
      toast.success("Link copied to clipboard!");
    }
  } catch (error) {
    // Ignore UserCancelled errors
    if ((error as any).message !== "Share canceled") {
      console.error("Error sharing:", error);
      toast.error("Failed to share");
    }
  }
}
