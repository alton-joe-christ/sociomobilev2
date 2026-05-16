"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { MessageSquareIcon, SparklesIcon, XIcon, TrashIcon } from "@/components/icons";

/* ─── Types ─────────────────────────────────────────── */
interface QA { q: string; a: string }
interface Message { role: "user" | "assistant"; content: string }

/* ─── Preset Q&A databases ──────────────────────────── */
const GLOBAL_QA: QA[] = [
  { q: "What is Socio?", a: "Socio is a campus event management platform that lets you discover, register for, and manage college events and fests — all in one place." },
  { q: "How do I register for an event?", a: "Open any event page and tap the 'Register' button. You'll need to be signed in with your college email." },
  { q: "How do I contact support?", a: "Reach out via the Contact page or email our support team. We're happy to help!" },
  { q: "Is there a desktop version?", a: "Yes! Visit socio2026.vercel.app on your laptop or desktop for the full web experience with more features." },
];

function getPageQA(pathname: string): QA[] {
  if (pathname === "/events") return [
    { q: "How do I find events?", a: "You're on the right page! Browse all upcoming events here. Use the search and filters to narrow down by category, date, or fest." },
    { q: "Can I filter events?", a: "Yes! Use the filter options at the top to filter by category (Technical, Cultural, Sports, etc.) or date." },
    { q: "Are events free?", a: "It depends on the event. Each event card shows whether it's free or paid. Tap on an event for full details." },
  ];
  if (pathname.startsWith("/event/")) return [
    { q: "How do I register?", a: "Tap the 'Register' button on this page. Make sure you're signed in first. You'll receive a confirmation with your QR code." },
    { q: "Where is the venue?", a: "The venue details are shown in the event information section on this page. Look for the location field." },
    { q: "What is the QR code for?", a: "After registering, you receive a QR code. This is scanned at the venue entrance for attendance tracking. Keep it handy!" },
    { q: "Can I cancel registration?", a: "Contact the event organiser directly for cancellations. You can find their details on the event page." },
  ];
  if (pathname === "/fests") return [
    { q: "What is a fest?", a: "A fest is a collection of related events, usually spanning multiple days — like a college cultural or technical festival." },
    { q: "How do I view fest events?", a: "Tap on any fest card to see all events that are part of that fest. You can register for individual events within." },
    { q: "When is the next fest?", a: "Check the fest cards on this page — each shows the start and end dates. Upcoming fests appear first." },
  ];
  if (pathname.startsWith("/fest/")) return [
    { q: "What events are in this fest?", a: "Scroll down on this page to see all events in this fest. You can register for each one individually." },
    { q: "How long does this fest run?", a: "The fest duration is shown at the top with start and end dates." },
  ];
  if (pathname === "/profile") return [
    { q: "Where are my registrations?", a: "Your registered events are shown on this page under the Registrations section. You can also see your attendance history." },
    { q: "Can I edit my profile here?", a: "Profile editing is not available right now. You can use this page to view your details, registrations, attendance history, and QR codes." },
    { q: "Where is my QR code?", a: "Your QR codes appear in the Registrations section. Tap on a registration to view or screenshot your QR." },
  ];
  if (pathname === "/discover") return [
    { q: "What is Discover?", a: "Discover helps you explore events and fests. Browse by category to find something you'll enjoy!" },
    { q: "Can I search for events?", a: "Yes! Use the search at the top to find events by name, or browse through categories." },
  ];
  if (pathname === "/" || pathname === "/notifications") return [
    { q: "Where do I start?", a: "Head to Events to browse upcoming events, or check Fests to see what's happening on campus." },
    { q: "How do I sign in?", a: "Tap Sign In and use your Google account. Use your college email for full access." },
    { q: "What can I do on Socio?", a: "Discover and register for campus events, track your registrations and attendance, and get notified about new events." },
  ];
  if (pathname === "/auth" || pathname === "/auth/login") return [
    { q: "How do I sign in?", a: "Tap 'Sign in with Google' to use your Google account. Use your college email if required by your institution." },
    { q: "I can't sign in", a: "Make sure pop-ups aren't blocked and you have a stable internet connection. Try clearing your browser cache." },
  ];
  return [];
}

/* ─── Fuzzy match typed questions ───────────────────── */
function findAnswer(input: string, qaList: QA[]): string | null {
  const lower = input.toLowerCase().trim();
  for (const qa of qaList) {
    const keywords = qa.q.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const hits = keywords.filter((k) => lower.includes(k)).length;
    if (hits >= 2 || (keywords.length <= 3 && hits >= 1)) return qa.a;
  }
  if (/register|sign.?up|join/i.test(lower)) return "To register for an event, open the event page and tap 'Register'. Make sure you're signed in first!";
  if (/qr|code|ticket/i.test(lower)) return "After registering, you receive a unique QR code for attendance. Find it on your Profile page.";
  if (/cancel|refund/i.test(lower)) return "To cancel a registration, please contact the event organiser directly via the event page.";
  if (/contact|help|support/i.test(lower)) return "You can reach our support team via the Contact page.";
  if (/fest|festival/i.test(lower)) return "Fests are collections of related events. Visit the Fests tab to browse upcoming festivals.";
  if (/profile|account/i.test(lower)) return "Visit your Profile to view your registrations, attendance history, and QR codes. Profile editing is not available right now.";
  return null;
}

/* ─── Component ─────────────────────────────────────── */
export default function ChatbotFab() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingIdx, setTypingIdx] = useState<number | null>(null);
  const [displayedLen, setDisplayedLen] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const pageQA = getPageQA(pathname);
  const allQA = [...pageQA, ...GLOBAL_QA];
  const quickQuestions = [...pageQA.slice(0, 3), ...GLOBAL_QA.slice(0, Math.max(0, 3 - pageQA.length))].map((qa) => qa.q);

  const isEventDetail = pathname.startsWith("/event/") && pathname.split("/").length === 3 && pathname.split("/")[2] !== "register";
  const fabBottomOffset = isEventDetail ? "100px" : "22px";

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, displayedLen]);

  /* Typewriter effect */
  useEffect(() => {
    if (typingIdx === null) return;
    const msg = messages[typingIdx];
    if (!msg) return;
    const fullLen = msg.content.length;
    if (displayedLen >= fullLen) { setTypingIdx(null); return; }
    const id = setTimeout(() => setDisplayedLen((l: number) => Math.min(l + 1, fullLen)), 12);
    return () => clearTimeout(id);
  }, [typingIdx, displayedLen, messages]);

  const handleQuestion = (text: string) => {
    if (!text.trim() || typingIdx !== null) return;
    setMessages((prev) => [...prev, { role: "user", content: text.trim() }]);
    const answer = findAnswer(text, allQA);
    const reply = answer || "I'm not sure about that one yet. Try another question below, or check the Events/Fests pages for more info!";
    setTimeout(() => {
      setMessages((prev) => {
        const next = [...prev, { role: "assistant" as const, content: reply }];
        setTypingIdx(next.length - 1);
        setDisplayedLen(0);
        return next;
      });
    }, 350);
  };

  const clearChat = () => { setMessages([]); setTypingIdx(null); setDisplayedLen(0); };
  const isTyping = typingIdx !== null;
  const asked = messages.filter((m) => m.role === "user").map((m) => m.content);
  const remaining = quickQuestions.filter((q) => !asked.includes(q));

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open help"
          className="fixed right-4 z-40 h-14 w-14 rounded-[20px] border border-[rgba(255,255,255,0.2)] bg-[#011F7B] text-white shadow-[0_8px_24px_rgba(1,31,123,0.15)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
          style={{ bottom: `calc(var(--bottom-nav) + var(--safe-bottom) + ${fabBottomOffset})` }}
        >
          <MessageSquareIcon size={22} strokeWidth={2} />
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <>
        <button
          type="button"
          aria-label="Close chat"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
        <div
          className="fixed z-50 flex flex-col rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[0_18px_50px_rgba(17,24,39,0.22)] overflow-hidden"
          style={{
            left: "12px",
            width: "min(86vw, 350px)",
            bottom: `calc(var(--bottom-nav, 0px) + var(--safe-bottom, 0px) + ${fabBottomOffset})`,
            maxHeight: "min(68dvh, 560px)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[var(--color-primary-dark)] to-[var(--color-primary)] text-white shrink-0 border-b border-white/15">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center">
                <MessageSquareIcon size={17} strokeWidth={2.1} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold leading-tight">SocioAssist</h2>
                <p className="text-[11px] opacity-80">Event help and platform guidance</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {messages.length > 0 && (
                <button onClick={clearChat} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors" aria-label="Clear chat">
                  <TrashIcon size={16} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors" aria-label="Close">
                <XIcon size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-3">
                <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-[var(--color-primary-light)] flex items-center justify-center border border-[var(--color-border)]">
                  <MessageSquareIcon size={22} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="font-bold text-[15px] text-[var(--color-text)]">How can we help?</p>
                  <p className="text-[13px] text-[var(--color-text-muted)] mt-1">
                    Select a common question to get instant guidance.
                  </p>
                </div>
                <div className="w-full mt-2 grid gap-2">
                  {quickQuestions.map((q) => (
                    <button key={q} onClick={() => handleQuestion(q)}
                      className="text-[12px] text-left px-3 py-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-white text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors break-words w-full flex items-center justify-between gap-2">
                      <span className="min-w-0">{q}</span>
                      <ArrowRightMini />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} w-full`}>
                <div className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed whitespace-pre-wrap break-words overflow-hidden shadow-xs ${
                  msg.role === "user"
                    ? "bg-[var(--color-primary)] text-white rounded-br-md"
                    : "bg-white text-[var(--color-text)] rounded-bl-md border border-[var(--color-border)]"
                }`}>
                  {i === typingIdx ? msg.content.slice(0, displayedLen) : msg.content}
                  {i === typingIdx && <span className="inline-block w-[2px] h-[14px] bg-gray-400 ml-0.5 align-middle animate-pulse" />}
                </div>
              </div>
            ))}

            {/* Typing indicator (before message arrives) */}
            {messages.length > 0 && messages[messages.length - 1].role === "user" && typingIdx === null && (
              <div className="flex justify-start">
                <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-gray-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            {messages.length > 0 && remaining.length > 0 && !isTyping && (
              <div className="pt-1">
                <p className="text-[11px] text-[var(--color-text-light)] mb-2 flex items-center gap-1.5">
                  <SparklesIcon size={12} className="text-[var(--color-primary)]" /> Suggested follow-ups
                </p>
                <div className="flex flex-wrap gap-2 max-w-full">
                {remaining.map((q) => (
                  <button key={q} onClick={() => handleQuestion(q)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--color-border)] text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors break-words max-w-full">
                    {q}
                  </button>
                ))}
                </div>
              </div>
            )}
          </div>


        </div>
        </>
      )}
    </>
  );
}

function ArrowRightMini() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
