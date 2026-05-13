import Link from "next/link";
import { CompassIcon } from "@/components/icons";

/**
 * 404 Not Found component for Next.js 15 App Router.
 */
export default function NotFound() {
  return (
    <div className="pwa-page-center bg-[var(--color-bg)] px-6">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-[var(--color-primary)]">
        <CompassIcon size={40} />
      </div>
      
      <h2 className="text-[24px] font-black tracking-tight text-[var(--color-text)]">
        Page Not Found
      </h2>
      
      <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-[var(--color-text-muted)]">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>

      <div className="mt-8 w-full max-w-[240px]">
        <Link
          href="/"
          className="btn btn-primary flex w-full items-center justify-center gap-2"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
