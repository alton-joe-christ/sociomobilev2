"use client";
import { createPortal } from "react-dom";

import { useEffect, useState } from "react";
import { XIcon, AlertCircleIcon, Loader2Icon, CalendarIcon, ClockIcon, MapPinIcon, DownloadIcon, ShieldCheckIcon } from "@/components/icons";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/apiClient";
import { generateSecurePassPayload } from "@/lib/walletCrypto";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

const SOCIO_SVG = `<svg width="319" height="94" viewBox="0 0 319 94" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="319" height="94" rx="16" fill="white"/>
<path d="M28 74.5C20.3 74.5 13.9 72.7 8.8 69.1C3.7 65.5 1 60.4 0.7 53.8H20.8C21 56 21.7 57.6 23 58.6C24.2 59.6 25.9 60.1 28 60.1C29.9 60.1 31.4 59.7 32.6 58.8C33.8 57.9 34.4 56.7 34.4 55C34.4 52.8 33.5 51.2 31.7 50.1C29.9 49 26.8 47.9 22.4 46.6C17.8 45.2 14.1 43.8 11.3 42.4C8.5 41 6.1 39 4.1 36.4C2.1 33.8 1.1 30.4 1.1 26.1C1.1 21.7 2.2 18 4.4 14.8C6.7 11.6 9.8 9.2 13.7 7.6C17.6 5.9 22.1 5.1 27.1 5.1C35.2 5.1 41.7 7.1 46.5 11.1C51.4 15.1 54 20.6 54.3 27.7H35.2C35.2 25.5 34.6 23.9 33.4 22.8C32.3 21.7 30.7 21.2 28.7 21.2C27.2 21.2 26 21.6 25.1 22.4C24.2 23.2 23.7 24.3 23.7 25.8C23.7 27.1 24.2 28.2 25.2 29.1C26.2 30 27.5 30.8 29.1 31.4C30.7 32.1 33 32.8 36 33.9C40.5 35.4 44.2 36.9 47.1 38.2C50 39.6 52.5 41.5 54.5 44C56.6 46.5 57.6 49.7 57.6 53.5C57.6 57.5 56.6 61.1 54.5 64.2C52.4 67.3 49.4 69.8 45.4 71.7C41.5 73.6 36.9 74.5 28 74.5Z" fill="#154CB3"/>
<path d="M93.8 74.5C87 74.5 80.7 72.9 75 69.7C69.2 66.5 64.7 62 61.3 56.3C58 50.6 56.3 44.1 56.3 36.8C56.3 29.6 58 23.1 61.3 17.4C64.7 11.7 69.2 7.2 75 4C80.7 0.8 87 0 93.8 0C100.7 0 106.9 0.8 112.5 4C118.2 7.2 122.6 11.7 125.8 17.4C129.1 23.1 130.7 29.6 130.7 36.8C130.7 44.1 129.1 50.6 125.8 56.3C122.6 62 118.2 66.5 112.5 69.7C106.9 72.9 100.7 74.5 93.8 74.5ZM93.8 56.5C98.8 56.5 102.8 54.9 105.8 51.7C108.8 48.4 110.3 44.1 110.3 38.7C110.3 33.2 108.8 28.8 105.8 25.7C102.8 22.5 98.8 20.9 93.8 20.9C88.8 20.9 84.9 22.5 81.9 25.7C79 28.8 77.5 33.2 77.5 38.7C77.5 44.1 79 48.4 81.9 51.7C84.9 54.9 88.8 56.5 93.8 56.5Z" fill="#154CB3"/>
<path d="M130 37C130 29.8 131.5 23.4 134.5 17.8C137.5 12.2 141.8 7.9 147.3 4.8C152.9 1.6 159.3 0 166.7 0C176.1 0 184 2.4 190.4 7.2C196.8 12 200.9 18.5 202.7 26.7H180.8C179.5 23.9 177.6 21.8 175.1 20.4C172.7 19 169.9 18.2 166.8 18.2C162 18.2 158.2 19.8 155.4 23.1C152.6 26.4 151.2 30.6 151.2 35.9C151.2 41.2 152.6 45.5 155.4 48.8C158.2 52.1 162 53.8 166.8 53.8C169.9 53.8 172.7 53 175.1 51.6C177.6 50.2 179.5 48.1 180.8 45.3H202.7C200.9 53.5 196.8 60 190.4 64.8C184 69.6 176.1 72 166.7 72C159.3 72 152.9 70.4 147.3 67.2C141.8 64.1 137.5 59.8 134.5 54.2C131.5 48.6 130 42.2 130 37Z" fill="#154CB3"/>
<path d="M216 6V68H196V6H216Z" fill="#154CB3"/>
<path d="M258.5 74.5C251.6 74.5 245.3 72.9 239.6 69.7C233.8 66.5 229.3 62 226 56.3C222.6 50.6 221 44.1 221 36.8C221 29.6 222.6 23.1 226 17.4C229.3 11.7 233.8 7.2 239.6 4C245.3 0.8 251.6 0 258.5 0C265.3 0 271.6 0.8 277.3 4C283.1 7.2 287.6 11.7 290.9 17.4C294.2 23.1 295.9 29.6 295.9 36.8C295.9 44.1 294.2 50.6 290.9 56.3C287.6 62 283.1 66.5 277.3 69.7C271.6 72.9 265.3 74.5 258.5 74.5ZM258.5 56.5C263.5 56.5 267.5 54.9 270.5 51.7C273.5 48.4 275 44.1 275 38.7C275 33.2 273.5 28.8 270.5 25.7C267.5 22.5 263.5 20.9 258.5 20.9C253.5 20.9 249.6 22.5 246.6 25.7C243.6 28.8 242.1 33.2 242.1 38.7C242.1 44.1 243.6 48.4 246.6 51.7C249.6 54.9 253.5 56.5 258.5 56.5Z" fill="#154CB3"/>
</svg>`;

function svgToPng(svgString: string, naturalW: number, naturalH: number, scale = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = naturalW * scale;
      canvas.height = naturalH * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function imgToPng(src: string): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = reject;
    img.src = src;
  });
}

interface QRCodeDisplayProps {
  registrationId: string;
  eventId: string;
  eventTitle: string;
  participantName: string;
  onClose: () => void;
  date?: string;
  time?: string;
  venue?: string;
}

export default function QRCodeDisplay({
  registrationId,
  eventId,
  eventTitle,
  participantName,
  onClose,
  date,
  time,
  venue,
}: QRCodeDisplayProps) {
  const { session, userData } = useAuth();
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const isOutsider = userData?.organization_type === "outsider";

  useEffect(() => {
    const fetchQRCode = async () => {
      if (!session?.access_token) {
        setError("Please sign in again to generate secure pass.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const cacheKey = `socio_qr_img_${registrationId}`;
        const cachedImage = localStorage.getItem(cacheKey);

        if (cachedImage) {
          setQrImage(cachedImage);
          setLoading(false);
          return;
        }

        const data = await apiRequest<{ qrCodeImage?: string }>(`/registrations/${encodeURIComponent(registrationId)}/qr-code`);

        if (!data || !data.qrCodeImage) {
          throw new Error("Invalid QR code received from server");
        }

        localStorage.setItem(cacheKey, data.qrCodeImage);
        setQrImage(data.qrCodeImage);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Network error while generating secure pass.");
      } finally {
        setLoading(false);
      }
    };

    fetchQRCode();
  }, [registrationId, session?.access_token]);

  const addToAppleWallet = async () => {
    try {
      const loadingToast = toast.loading("Preparing secure credential...");
      await generateSecurePassPayload({
        attendeeId: "apple-wallet",
        eventId,
        registrationId,
        participantName: participantName || "Attendee",
      });
      await new Promise((resolve) => setTimeout(resolve, 600));
      toast.dismiss(loadingToast);
      toast.success("Pass added successfully");
    } catch {
      toast.dismiss();
      toast.error("Unable to generate secure pass");
    }
  };

  void addToAppleWallet;

  const addToGoogleWallet = async () => {
    try {
      const loadingToast = toast.loading("Preparing secure credential...");
      const res = await fetch("/api/wallet/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId,
          eventId,
          eventTitle,
          participantName,
          venue,
          date,
          time,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to prepare wallet pass");
      }

      const data = await res.json();
      toast.dismiss(loadingToast);
      toast.success("Pass ready to save");
      if (data.saveUrl) {
        window.open(data.saveUrl, "_blank");
      }
    } catch (err: unknown) {
      toast.dismiss();
      const message = err instanceof Error ? err.message : "Unable to generate Google Wallet pass";
      toast.error(message);
      console.error("Google Wallet redirect failed:", err);
    }
  };

  void addToGoogleWallet;

  const downloadAsPDF = async () => {
    if (!qrImage || pdfLoading) return;
    setPdfLoading(true);
    try {
      const { jsPDF } = await import("jspdf");

      const PW = 210;
      const MARGIN = 15;
      const CX = PW / 2;
      const WORK = PW - MARGIN * 2;

      const measureDoc = new jsPDF({ unit: "mm", format: "a4" });
      measureDoc.setFont("helvetica", "bold");
      measureDoc.setFontSize(12);
      const titleLines = measureDoc.splitTextToSize(eventTitle, WORK) as string[];

      const [socioDataUrl, christLogo] = await Promise.all([
        svgToPng(SOCIO_SVG, 319, 94),
        imgToPng("/christuniversitylogo.png").catch(() => null),
      ]);

      const socioW = 52;
      const socioH = Math.round((socioW * 94) / 319);
      const christW = 40;
      const christH = christLogo ? Math.round((christW * christLogo.h) / christLogo.w) : 0;
      const logoRowH = Math.max(socioH, christH, 16);

      let y = 12;
      const yLogoTop = y;
      y += logoRowH + 7;
      const yRule = y;
      y += 13;
      const yGated = y;
      y += 9;
      const ySubtitle = y;
      y += 12;
      const yQrTop = y;
      const QR = 108;
      y += QR + 10;
      const yTitle = y;
      y += titleLines.length * 6 + 4;
      const yParticipant = y;
      y += 6;
      const yRegId = y;
      y += 10;
      const yDashed = y;
      y += 7;
      const yFooter = y;
      if (isOutsider) y += 5.5;
      y += 13;

      const pageH = Math.ceil(y);
      const doc = new jsPDF({ unit: "mm", format: [PW, pageH] });

      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, PW, pageH, "F");

      const socioOffset = Math.round((logoRowH - socioH) / 2);
      doc.addImage(socioDataUrl, "PNG", MARGIN, yLogoTop + socioOffset, socioW, socioH);

      if (christLogo) {
        const christOffset = Math.round((logoRowH - christH) / 2);
        doc.addImage(christLogo.dataUrl, "PNG", PW - MARGIN - christW, yLogoTop + christOffset, christW, christH);
      }

      doc.setDrawColor(21, 76, 179);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, yRule, PW - MARGIN, yRule);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(40);
      doc.setTextColor(21, 76, 179);
      doc.text("G  A  T  E  D", CX, yGated, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("O F F I C I A L   E N T R Y   P A S S", CX, ySubtitle, { align: "center" });

      const qrX = (PW - QR) / 2;
      const qrPad = 5;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.35);
      doc.roundedRect(qrX, yQrTop, QR, QR, 3, 3, "FD");

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(qrX + 1, yQrTop + 1, QR - 2, QR - 2, 2, 2, "F");
      doc.addImage(qrImage, "PNG", qrX + qrPad, yQrTop + qrPad, QR - qrPad * 2, QR - qrPad * 2);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 37, 87);
      doc.text(titleLines, CX, yTitle, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text(participantName, CX, yParticipant, { align: "center" });

      doc.setFontSize(7);
      doc.setTextColor(180, 194, 210);
      doc.text(`ID: ${registrationId}`, CX, yRegId, { align: "center" });

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      doc.setLineDashPattern([1.8, 1.8], 0);
      doc.line(MARGIN, yDashed, PW - MARGIN, yDashed);
      doc.setLineDashPattern([], 0);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Scan this QR code to get your attendance marked at the event.", CX, yFooter, { align: "center" });
      if (isOutsider) {
        doc.text("Show this at the campus gate for entry.", CX, yFooter + 5.5, { align: "center" });
      }

      doc.save(`GatedPass ${eventTitle}.pdf`);
    } catch (err: unknown) {
      console.error("PDF generation failed:", err);
    } finally {
      setPdfLoading(false);
    }
  };

  const formatEventDate = (rawDate?: string) => {
    if (!rawDate) return { main: "TBA", sub: "" };
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return { main: "TBA", sub: "" };
    return {
      main: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      sub: d.toLocaleDateString("en-US", { weekday: "long" }),
    };
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const dateInfo = formatEventDate(date);

  if (!mounted) return null;

  return createPortal(
    <div
      className="pass-modal-shell fixed inset-0 z-[9999] flex items-center justify-center overscroll-none touch-none"
    >
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pass-backdrop absolute inset-0 bg-[#020617]/72 backdrop-blur-[14px]"
        />
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="pass-panel relative w-[calc(100vw-32px)] max-w-[420px] bg-[#F8FAFC] rounded-[36px] shadow-[0_30px_80px_rgba(1,31,123,0.22)] flex flex-col overflow-hidden overscroll-contain"
        style={{
          maxHeight: "90dvh",
        }}
      >
        {/* Header Section */}
        <div
          className="pass-header relative shrink-0 overflow-hidden bg-gradient-to-br from-[#011F7B] to-[#1E3FAB] px-6 pt-6 pb-9 rounded-t-[36px]"
        >
          {/* Subtle Blueprint Dots */}
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '16px 16px' }} />
          {/* Subtle Glow / Light Beam */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28)_0%,transparent_55%)] pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12)_0%,transparent_72%)] pointer-events-none" />

          <div className="relative z-10 pr-14">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#FFBA09] shadow-[0_0_8px_rgba(255,186,9,0.9)]" />
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-white/90">EVENT PASS</span>
            </div>

            <h3 className="pass-title mt-[18px] max-w-full text-[clamp(20px,5.5vw,28px)] font-[800] tracking-[-0.04em] text-white leading-[0.95] line-clamp-2">
              {eventTitle}
            </h3>

            <p className="mt-2 text-[12px] font-medium text-white/60">
              Your pass to an amazing experience
            </p>
          </div>

          <button
            onClick={onClose}
            className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/16 bg-white/12 text-white backdrop-blur-[16px] transition-transform duration-200 hover:bg-white/18 active:scale-95 z-20"
            aria-label="Close"
          >
            <XIcon size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="pass-modal-content no-scrollbar flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
          
          {/* Floating Info Card */}
          <div className="relative z-20 -mt-6 mx-4 bg-white/98 rounded-[28px] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)] border border-slate-100/50 backdrop-blur-sm">
            <div className="grid grid-cols-3 divide-x divide-slate-100">
              {/* Date Column */}
              <div className="flex flex-col items-center text-center px-1 min-w-0">
                <CalendarIcon size={14} className="text-[#FFBA09] mb-1.5" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">Date</span>
                <span className="mt-2 text-[12px] font-extrabold text-[#0F172A] leading-tight w-full break-words">{dateInfo.main}</span>
                <span className="text-[10px] font-medium text-[#64748B] mt-0.5">{dateInfo.sub}</span>
              </div>

              {/* Time Column */}
              <div className="flex flex-col items-center text-center px-1 min-w-0">
                <ClockIcon size={14} className="text-[#FFBA09] mb-1.5" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">Time</span>
                <span className="mt-2 text-[12px] font-extrabold text-[#0F172A] leading-tight w-full break-words">{time || "12:00 PM"}</span>
                <span className="text-[10px] font-medium text-[#64748B] mt-0.5">IST</span>
              </div>

              {/* Venue Column */}
              <div className="flex flex-col items-center text-center px-1 min-w-0">
                <MapPinIcon size={14} className="text-[#FFBA09] mb-1.5" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">Venue</span>
                <span className="mt-2 text-[12px] font-extrabold text-[#0F172A] leading-tight w-full line-clamp-2 break-words" title={venue}>
                  {venue || "TBA"}
                </span>
                <span className="text-[10px] font-medium text-[#64748B] mt-0.5">Location</span>
              </div>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="flex justify-center mt-5 px-4">
            {loading ? (
              <div className="flex aspect-square w-full max-w-[280px] min-w-[220px] items-center justify-center rounded-[32px] border border-slate-100 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <Loader2Icon size={28} className="animate-spin text-[#011F7B] opacity-35" />
              </div>
            ) : error ? (
              <div className="flex aspect-square w-full max-w-[280px] min-w-[220px] flex-col items-center justify-center rounded-[32px] border border-red-100 bg-red-50 p-6 text-center shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <AlertCircleIcon size={22} className="mb-2 text-red-500" />
                <p className="text-[12px] font-semibold text-red-600 leading-snug">{error}</p>
              </div>
            ) : (
              <div className="flex aspect-square w-full max-w-[280px] min-w-[220px] items-center justify-center rounded-[32px] border border-slate-100 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <img
                  src={qrImage || ""}
                  alt="Secure QR code"
                  className="h-full w-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
            )}
          </div>

          {/* Download Button */}
          <div className="px-4 mt-6">
            <button
              onClick={downloadAsPDF}
              disabled={pdfLoading || loading}
              className="flex h-16 w-full items-center justify-center gap-2.5 rounded-[22px] bg-[#FFBA09] text-[#011F7B] font-bold text-[15px] shadow-[0_8px_24px_rgba(255,186,9,0.3)] transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 hover:brightness-105"
            >
              {pdfLoading ? (
                <Loader2Icon size={18} className="animate-spin" />
              ) : (
                <>
                  <DownloadIcon size={20} strokeWidth={3} className="shrink-0" />
                  <span>Download Pass (PDF)</span>
                </>
              )}
            </button>
          </div>

          {/* Attendance Info Card */}
          <div className="px-4 mt-4">
            <div className="flex items-center gap-3.5 rounded-[24px] border border-[#E2E8F0] bg-[#F8FAFC] p-[18px]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#011F7B] shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
                <ShieldCheckIcon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-snug text-[#0F172A]">Show this QR at entry</p>
                <p className="mt-0.5 text-[11px] font-medium leading-snug text-[#64748B]">You will be scanned for attendance</p>
              </div>
            </div>
          </div>

        </div>
      </motion.div>

      <style jsx>{`
        .overscroll-none {
          overscroll-behavior: none;
        }
        .pass-modal-shell {
          padding-top: calc(16px + env(safe-area-inset-top, 0px));
          padding-right: 16px;
          padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          padding-left: 16px;
        }
        .pass-backdrop {
          background: radial-gradient(circle at top, rgba(30,63,171,0.24), transparent 62%), rgba(2, 6, 23, 0.72);
        }
        .pass-title {
          display: -webkit-box;
          line-height: 0.95;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }
        .pass-modal-content {
          -webkit-overflow-scrolling: touch;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>,
    document.body
  );
}