"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { XIcon, AlertCircleIcon, Loader2Icon, CalendarIcon, ClockIcon, MapPinIcon, DownloadIcon } from "@/components/icons";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/apiClient";
import { generateSecurePassPayload } from "@/lib/walletCrypto";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

// Inline SOCIO SVG so it doesn't need a public URL
const SOCIO_SVG = `<svg width="319" height="94" viewBox="0 0 319 94" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M32.6035 80.4229C23.5462 80.4229 16.1087 78.2719 10.291 73.9646C4.4681 69.6625 1.3431 63.4959 0.916016 55.4646H23.9785C24.1973 58.1886 25.0098 60.1834 26.416 61.4438C27.8171 62.6938 29.6243 63.3188 31.8327 63.3188C33.8171 63.3188 35.4473 62.8188 36.7285 61.8188C38.0202 60.8188 38.666 59.4386 38.666 57.6729C38.666 55.3969 37.5931 53.6313 35.4577 52.3813C33.3327 51.1313 29.8743 49.7302 25.0827 48.1729C20.0098 46.4959 15.9056 44.8604 12.7702 43.2771C9.64518 41.6938 6.92122 39.3761 4.60352 36.3188C2.2806 33.2667 1.12435 29.2719 1.12435 24.3396C1.12435 19.3292 2.37435 15.0375 4.87435 11.4646C7.38477 7.89689 10.8535 5.19377 15.2702 3.36043C19.6868 1.51668 24.6868 0.5896 30.2702 0.5896C39.3223 0.5896 46.5514 2.70939 51.9577 6.94377C57.3744 11.1834 60.2702 17.1261 60.6452 24.7771H37.1244C37.0514 22.4177 36.3379 20.6521 34.9785 19.4854C33.6139 18.3084 31.8639 17.7146 29.7285 17.7146C28.1035 17.7146 26.7754 18.1938 25.7493 19.1521C24.7181 20.1 24.2077 21.4594 24.2077 23.2354C24.2077 24.7094 24.7754 25.9802 25.916 27.0479C27.0514 28.1052 28.4681 29.0219 30.166 29.7979C31.8587 30.5792 34.3587 31.5479 37.666 32.7146C42.6087 34.4125 46.6764 36.0896 49.8744 37.7563C53.0827 39.4125 55.8431 41.7302 58.166 44.7146C60.4837 47.6886 61.6452 51.4594 61.6452 56.0271C61.6452 60.6677 60.4837 64.8292 58.166 68.5063C55.8431 72.1886 52.4889 75.1 48.1035 77.2354C43.7285 79.3604 38.5619 80.4229 32.6035 80.4229Z" fill="#154CB3"/>
<path d="M100.38 80.4229C93.099 80.4229 86.4063 78.7146 80.2969 75.2979C74.1823 71.8709 69.3437 67.1209 65.776 61.0479C62.2031 54.9802 60.4219 48.1104 60.4219 40.4438C60.4219 32.7927 62.2031 25.9334 65.776 19.8604C69.3437 13.7927 74.1823 9.06356 80.2969 5.67293C86.4063 2.28752 93.099 0.5896 100.38 0.5896C107.74 0.5896 114.453 2.28752 120.526 5.67293C126.609 9.06356 131.411 13.7927 134.943 19.8604C138.484 25.9334 140.255 32.7927 140.255 40.4438C140.255 48.1104 138.484 54.9802 134.943 61.0479C131.411 67.1209 126.594 71.8709 120.484 75.2979C114.37 78.7146 107.672 80.4229 100.38 80.4229ZM100.38 60.3188C105.906 60.3188 110.266 58.5219 113.464 54.9229C116.672 51.3136 118.276 46.4854 118.276 40.4438C118.276 34.2667 116.672 29.3917 113.464 25.8188C110.266 22.2511 105.906 20.4646 100.38 20.4646C94.7813 20.4646 90.401 22.2511 87.2344 25.8188C84.0781 29.3917 82.5052 34.2667 82.5052 40.4438C82.5052 46.5584 84.0781 51.3969 87.2344 54.9646C90.401 58.5375 94.7813 60.3188 100.38 60.3188Z" fill="#154CB3"/>
<path d="M138.699 40.5688C138.699 32.9177 140.293 26.0896 143.491 20.0896C146.699 14.0896 151.246 9.41773 157.137 6.06877C163.022 2.70939 169.793 1.0271 177.449 1.0271C187.168 1.0271 195.345 3.62606 201.97 8.81877C208.595 14.0167 212.855 21.0636 214.762 29.9646H191.47C190.064 27.0219 188.126 24.7771 185.658 23.2354C183.199 21.6834 180.35 20.9021 177.116 20.9021C172.116 20.9021 168.121 22.6886 165.137 26.2563C162.147 29.8292 160.658 34.6 160.658 40.5688C160.658 46.6 162.147 51.3969 165.137 54.9646C168.121 58.5375 172.116 60.3188 177.116 60.3188C180.35 60.3188 183.199 59.5479 185.658 58.0063C188.126 56.4646 190.064 54.225 191.47 51.2771H214.762C212.855 60.1834 208.595 67.2302 201.97 72.4229C195.345 77.6209 187.168 80.2146 177.449 80.2146C169.793 80.2146 163.022 78.5427 157.137 75.1938C151.246 71.8344 146.699 67.1521 143.491 61.1521C140.293 55.1521 138.699 48.2927 138.699 40.5688Z" fill="#154CB3"/>
<path d="M238 5V76H216V5H238Z" fill="#154CB3"/>
<path d="M279.124 80.4229C271.843 80.4229 265.15 78.7146 259.041 75.2979C252.926 71.8709 248.088 67.1209 244.52 61.0479C240.947 54.9802 239.166 48.1104 239.166 40.4438C239.166 32.7927 240.947 25.9334 244.52 19.8604C248.088 13.7927 252.926 9.06356 259.041 5.67293C265.15 2.28752 271.843 0.5896 279.124 0.5896C286.484 0.5896 293.197 2.28752 299.27 5.67293C305.354 9.06356 310.156 13.7927 313.687 19.8604C317.229 25.9334 318.999 32.7927 318.999 40.4438C318.999 48.1104 317.229 54.9802 313.687 61.0479C310.156 67.1209 305.338 71.8709 299.229 75.2979C293.114 78.7146 286.416 80.4229 279.124 80.4229ZM279.124 60.3188C284.65 60.3188 289.01 58.5219 292.208 54.9229C295.416 51.3136 297.02 46.4854 297.02 40.4438C297.02 34.2667 295.416 29.3917 292.208 25.8188C289.01 22.2511 284.65 20.4646 279.124 20.4646C273.525 20.4646 269.145 22.2511 265.979 25.8188C262.822 29.3917 261.249 34.2667 261.249 40.4438C261.249 46.5584 262.822 51.3969 265.979 54.9646C269.145 58.5375 273.525 60.3188 279.124 60.3188Z" fill="#154CB3"/>
<mask id="mask0_482_185" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="104" y="18" width="74" height="76">
<path d="M104.381 18.1562H177.381V93.1563H104.381V18.1562Z" fill="white"/>
</mask>
<g mask="url(#mask0_482_185)">
<path d="M177.385 55.0625H166.62C148.188 51.0729 144.089 46.9583 140.099 28.5V18.1562H138.74V28.6094C134.76 46.9792 130.641 51.0833 112.245 55.0625H104.391V56.4219H112.245C130.641 60.4063 134.76 64.5104 138.74 82.875V93.1354H140.099V82.9844C144.089 64.526 148.188 60.4115 166.62 56.4219H177.385V55.0625Z" fill="white"/>
</g>
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

        const data = await apiRequest<any>(`/registrations/${encodeURIComponent(registrationId)}/qr-code`);
        
        if (!data || !data.qrCodeImage) {
          throw new Error("Invalid QR code received from server");
        }

        localStorage.setItem(cacheKey, data.qrCodeImage);
        setQrImage(data.qrCodeImage);
      } catch (err: any) {
        setError(err.message || "Network error while generating secure pass.");
      } finally {
        setLoading(false);
      }
    };

    fetchQRCode();
  }, [registrationId, eventId, session?.access_token, userData, participantName]);

  // Scroll Lock
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const addToAppleWallet = async () => {
    try {
      const loadingToast = toast.loading("Preparing secure credential...");
      await generateSecurePassPayload({
        attendeeId: 'apple-wallet',
        eventId,
        registrationId,
        participantName: participantName || 'Attendee',
      });
      await new Promise(resolve => setTimeout(resolve, 600));
      toast.dismiss(loadingToast);
      toast.success("Pass added successfully");
    } catch {
      toast.dismiss();
      toast.error("Unable to generate secure pass");
    }
  };

  const addToGoogleWallet = async () => {
    try {
      const loadingToast = toast.loading("Preparing secure credential...");
      const res = await fetch('/api/wallet/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          registrationId, 
          eventId, 
          eventTitle, 
          participantName, 
          venue, 
          date, 
          time 
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to prepare wallet pass");
      }

      const data = await res.json();
      toast.dismiss(loadingToast);
      toast.success("Pass ready to save");
      if (data.saveUrl) {
        window.open(data.saveUrl, '_blank');
      }
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || "Unable to generate Google Wallet pass");
      console.error("Google Wallet redirect failed:", err);
    }
  };

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

      const yLogoTop    = y;
      y += logoRowH + 7;
      const yRule       = y;
      y += 13;
      const yGated      = y;
      y += 9;
      const ySubtitle   = y;
      y += 12;
      const yQrTop      = y;
      const QR          = 108;
      y += QR + 10;
      const yTitle      = y;
      y += titleLines.length * 6 + 4;
      const yParticipant = y;
      y += 6;
      const yRegId      = y;
      y += 10;
      const yDashed     = y;
      y += 7;
      const yFooter     = y;
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

      doc.addImage(
        qrImage, "PNG",
        qrX + qrPad, yQrTop + qrPad,
        QR - qrPad * 2, QR - qrPad * 2
      );

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
    } catch (err) {
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
      sub: d.toLocaleDateString("en-US", { weekday: "long" })
    };
  };

  const dateInfo = formatEventDate(date);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overscroll-none touch-none p-4">
      {/* Backdrop - High focus blackout */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#020617]/96 backdrop-blur-[24px]"
      />

      {/* Modal Container - Locked visual center */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-[360px] bg-white rounded-[40px] shadow-[0_50px_100px_rgba(0,0,0,0.7)] border border-white/10 flex flex-col overflow-hidden"
        style={{
          maxHeight: 'min(92dvh, 660px)',
        }}
      >
        {/* Header Section - Reduced Blue height */}
        <div className="relative h-[100px] shrink-0 overflow-hidden flex flex-col p-5 bg-[#011F7B]">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.6)_0,transparent_100%)] pointer-events-none" />
          
          <div className="flex items-center justify-between relative z-10 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FFBA09] shadow-[0_0_10px_#FFBA09] animate-pulse" />
              <span className="text-[9px] font-black tracking-[0.2em] text-white/90 uppercase">Official Pass</span>
            </div>
            
            <button 
              onClick={onClose} 
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all active:scale-90" 
              aria-label="Close"
            >
              <XIcon size={18} className="text-white" strokeWidth={3} />
            </button>
          </div>

          <div className="mt-auto relative z-10 pb-1">
            <h3 className="text-[18px] font-black text-white tracking-tight leading-tight truncate w-full">{eventTitle}</h3>
            <p className="text-[10px] text-white/50 font-bold truncate w-full uppercase tracking-[0.15em]">{participantName}</p>
          </div>
        </div>

        {/* Content Section - Improved distribution */}
        <div className="flex-1 flex flex-col px-5 py-6 items-center justify-between min-h-0 gap-4">
          
          {/* Info Bar - Optimized for No Overlap */}
          <div className="w-full flex items-stretch bg-white border border-[#E2E8F0] rounded-[22px] p-3 shadow-[0_8px_30px_rgba(0,0,0,0.04)] -mt-10 relative z-20 min-h-[64px]">
            {/* Date Section */}
            <div className="flex-1 flex gap-2 min-w-0">
              <CalendarIcon size={14} className="text-[#FFBA09] shrink-0 mt-0.5" />
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] text-[#94A3B8] font-bold uppercase tracking-tighter">Date</span>
                <span className="text-[10px] text-[#0F172A] font-black leading-tight break-words">{dateInfo.main}</span>
                <span className="text-[8px] text-[#94A3B8] font-bold leading-tight truncate">{dateInfo.sub}</span>
              </div>
            </div>

            <div className="w-px bg-[#F1F5F9] mx-2" />

            {/* Time Section */}
            <div className="flex-1 flex gap-2 min-w-0">
              <ClockIcon size={14} className="text-[#FFBA09] shrink-0 mt-0.5" />
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] text-[#94A3B8] font-bold uppercase tracking-tighter">Time</span>
                <span className="text-[10px] text-[#0F172A] font-black leading-tight break-words">{time || "TBA"}</span>
                <span className="text-[8px] text-[#94A3B8] font-bold leading-tight truncate">IST</span>
              </div>
            </div>

            <div className="w-px bg-[#F1F5F9] mx-2" />

            {/* Venue Section */}
            <div className="flex-1 flex gap-2 min-w-0">
              <MapPinIcon size={14} className="text-[#FFBA09] shrink-0 mt-0.5" />
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] text-[#94A3B8] font-bold uppercase tracking-tighter">Venue</span>
                <span className="text-[10px] text-[#0F172A] font-black leading-tight break-words" title={venue}>{venue || "TBA"}</span>
              </div>
            </div>
          </div>

          {/* QR Container - Vertically Balanced */}
          <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[160px]">
            {loading ? (
              <Loader2Icon size={32} className="animate-spin text-[#011F7B] opacity-20" />
            ) : error ? (
              <div className="text-center p-4 bg-red-50 rounded-2xl border border-red-100">
                <AlertCircleIcon size={20} className="text-red-500 mx-auto mb-2" />
                <p className="text-[11px] text-red-600 font-bold">{error}</p>
              </div>
            ) : (
              <div className="p-3 bg-white border-[2px] border-[#F8FAFC] rounded-[36px] shadow-sm ring-8 ring-[#F8FAFC]/30">
                <img 
                  src={qrImage || ""} 
                  alt="QR code" 
                  className="w-[150px] h-[150px] sm:w-[160px] sm:h-[160px] object-contain" 
                  style={{ imageRendering: 'pixelated' }} 
                />
              </div>
            )}
          </div>

          {/* Actions - More Compact */}
          <div className="w-full space-y-3.5">
            <button
              onClick={downloadAsPDF}
              disabled={pdfLoading || loading}
              className="w-full h-[54px] bg-[#FFBA09] text-[#011F7B] rounded-2xl font-black text-[14px] shadow-[0_12px_24px_rgba(255,186,9,0.3)] flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {pdfLoading ? (
                <Loader2Icon size={18} className="animate-spin" />
              ) : (
                <>
                  <DownloadIcon size={20} strokeWidth={3} />
                  Download Pass (PDF)
                </>
              )}
            </button>

            <div className="bg-[#FFF9E8] rounded-2xl py-3 px-4 flex flex-col items-center justify-center border border-[rgba(255,186,9,0.1)]">
              <p className="text-[9px] font-black text-[#011F7B] text-center uppercase tracking-[0.15em] opacity-80">
                Official Attendance QR
              </p>
              <span className="text-[7.5px] text-[#011F7B]/40 font-bold mt-1 tracking-tight break-all text-center">
                ID: {registrationId}
              </span>
            </div>
          </div>

        </div>
      </motion.div>

      <style jsx>{`
        .overscroll-none { overscroll-behavior: none; }
      `}</style>
    </div>
  );
}
