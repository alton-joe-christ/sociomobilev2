"use client";

import React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}


const IconBase = ({
  size = 24,
  children,
  ...props
}: IconProps & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {children}
  </svg>
);

export const SearchIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </IconBase>
);

export const CalendarIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
  </IconBase>
);

export const MapPinIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </IconBase>
);

export const ClockIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </IconBase>
);

export const UsersIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </IconBase>
);

export const HeartIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </IconBase>
);

export const SparklesIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </IconBase>
);

export const ArrowRightIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </IconBase>
);

export const ArrowLeftIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </IconBase>
);

export const FilterIcon = (props: IconProps) => (
  <IconBase {...props}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </IconBase>
);

export const XIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </IconBase>
);

export const TrendingUpIcon = (props: IconProps) => (
  <IconBase {...props}>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </IconBase>
);

export const FlameIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </IconBase>
);

export const SortAZIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m3 8 4-4 4 4" />
    <path d="M7 4v16" />
    <path d="M20 8h-5" />
    <path d="M15 10V6.5a2.5 2.5 0 0 1 5 0V10" />
    <path d="M15 14h5l-5 6h5" />
  </IconBase>
);

export const InfoIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </IconBase>
);

export const CheckIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M20 6 9 17l-5-5" />
  </IconBase>
);

export const BellIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </IconBase>
);

export const TicketIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2" />
    <path d="M13 17v2" />
    <path d="M13 11v2" />
  </IconBase>
);

export const PencilIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </IconBase>
);

export const QrCodeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect width="5" height="5" x="3" y="3" rx="1" />
    <rect width="5" height="5" x="16" y="3" rx="1" />
    <rect width="5" height="5" x="3" y="16" rx="1" />
    <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
    <path d="M21 21v.01" />
    <path d="M12 7v3a2 2 0 0 1-2 2H7" />
    <path d="M3 12h.01" />
    <path d="M12 3h.01" />
    <path d="M12 16v.01" />
    <path d="M16 12h1" />
    <path d="M21 12v.01" />
    <path d="M12 21v-1" />
  </IconBase>
);

export const CameraIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </IconBase>
);

export const CheckCircleIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </IconBase>
);

export const XCircleIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </IconBase>
);

export const MailIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </IconBase>
);

export const HashIcon = (props: IconProps) => (
  <IconBase {...props}>
    <line x1="4" x2="20" y1="9" y2="9" />
    <line x1="4" x2="20" y1="15" y2="15" />
    <line x1="10" x2="8" y1="3" y2="21" />
    <line x1="16" x2="14" y1="3" y2="21" />
  </IconBase>
);

export const GraduationCapIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M21.42 10.922a2 2 0 0 0-.019-3.838L12.83 4.18a2 2 0 0 0-1.66 0L2.6 7.08a2 2 0 0 0 0 3.832l8.58 3.908a2 2 0 0 0 1.664 0z" />
    <path d="M22 10v6" />
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
  </IconBase>
);

export const BuildingIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" />
    <path d="M16 6h.01" />
    <path d="M12 6h.01" />
    <path d="M12 10h.01" />
    <path d="M12 14h.01" />
    <path d="M16 10h.01" />
    <path d="M16 14h.01" />
    <path d="M8 10h.01" />
    <path d="M8 14h.01" />
  </IconBase>
);

export const LogOutIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" x2="9" y1="12" y2="12" />
  </IconBase>
);

export const ChevronRightIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m9 18 6-6-6-6" />
  </IconBase>
);

export const ShareIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
    <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
  </IconBase>
);

export const GlobeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    <path d="M2 12h20" />
  </IconBase>
);

export const TagIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828z" />
    <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
  </IconBase>
);

export const FileTextIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" x2="8" y1="13" y2="13" />
    <line x1="16" x2="8" y1="17" y2="17" />
    <line x1="10" x2="8" y1="9" y2="9" />
  </IconBase>
);

export const TrophyIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7c0 3.31 2.69 6 6 6s6-2.69 6-6V2z" />
  </IconBase>
);

export const ListChecksIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m3 17 2 2 4-4" />
    <path d="m3 7 2 2 4-4" />
    <path d="M13 6h8" />
    <path d="M13 12h8" />
    <path d="M13 18h8" />
  </IconBase>
);

export const PhoneIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </IconBase>
);

export const MessageCircleIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </IconBase>
);

export const AlertCircleIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </IconBase>
);

export const Loader2Icon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </IconBase>
);

export const ChevronDownIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m6 9 6 6 6-6" />
  </IconBase>
);

export const ChevronUpIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m18 15-6-6-6 6" />
  </IconBase>
);

export const AwardIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="8" r="6" />
    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
  </IconBase>
);

export const MegaphoneIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m3 11 18-5v12L3 14v-3z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </IconBase>
);

export const CheckCheckIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M18 6 7 17l-5-5" />
    <path d="m22 10-7.5 7.5L13 16" />
  </IconBase>
);

export const UserIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </IconBase>
);

export const HomeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </IconBase>
);

export const CompassIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </IconBase>
);

export const CalendarDaysIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
    <path d="M8 14h.01" />
    <path d="M12 14h.01" />
    <path d="M16 14h.01" />
    <path d="M8 18h.01" />
    <path d="M12 18h.01" />
    <path d="M16 18h.01" />
  </IconBase>
);

export const FlameIcon2 = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </IconBase>
);

export const MessageSquareIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </IconBase>
);

export const SmartphoneIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
    <path d="M12 18h.01" />
  </IconBase>
);

export const MonitorIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <line x1="8" x2="16" y1="21" y2="21" />
    <line x1="12" x2="12" y1="17" y2="21" />
  </IconBase>
);

export const DownloadIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </IconBase>
);

export const BellRingIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    <path d="M4 2C2.8 3.7 2 5.7 2 8" />
    <path d="M22 8c0-2.3-.8-4.3-2-6" />
  </IconBase>
);

export const RefreshCwIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </IconBase>
);

export const RefreshCcwIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </IconBase>
);

export const CopyIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </IconBase>
);

export const WifiOffIcon = (props: IconProps) => (
  <IconBase {...props}>
    <line x1="2" x2="22" y1="2" y2="22" />
    <path d="M8.5 16.5a5 5 0 0 1 7 0" />
    <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
    <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
    <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
    <path d="M5 12.03a10 10 0 0 1 5.17-2.8" />
    <circle cx="12" cy="20" r="1" />
  </IconBase>
);

export const AlertTriangleIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </IconBase>
);

export const ShieldCheckIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M20 13c0 5-3.5 7.5-7.33 8.76a2 2 0 0 1-1.34 0C7.5 20.5 4 18 4 13V5.5a2 2 0 0 1 1.2-1.83l6-2.4a2 2 0 0 1 1.6 0l6 2.4A2 2 0 0 1 20 5.5V13Z" />
    <path d="m9 12 2 2 4-4" />
  </IconBase>
);

export const SchoolIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M14 22v-4a2 2 0 1 0-4 0v4" />
    <path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2" />
    <path d="M18 5v17" />
    <path d="m4 6 8-4 8 4" />
    <path d="M6 5v17" />
    <circle cx="12" cy="9" r="2" />
  </IconBase>
);

export const HelpCircleIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </IconBase>
);

export const Clock3Icon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16.5 12" />
  </IconBase>
);

export const TicketIcon2 = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2" />
    <path d="M13 17v2" />
    <path d="M13 11v2" />
  </IconBase>
);

export const MapPinIcon2 = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </IconBase>
);

export const TrashIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </IconBase>
);

export const SettingsIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </IconBase>
);
export const ChefHatIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6 13.8a4.41 4.41 0 1 1 2.6-7.6 4.41 4.41 0 1 1 6.8 0 4.41 4.41 0 1 1 2.6 7.6 4.41 4.41 0 0 1-12 0Z" />
    <path d="M7 13v4h10v-4" />
    <path d="M17 17v2a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2" />
  </IconBase>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m15 18-6-6 6-6" />
  </IconBase>
);export const HistoryIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </IconBase>
);

export const ZapIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </IconBase>
);

export const UtensilsIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <path d="M7 2v20" />
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Z" />
    <path d="M18 15v7" />
  </IconBase>
);

export const FlashlightIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M18.66 10.5a2 2 0 1 1-3.66 0 2 2 0 0 1 3.66 0z" />
    <path d="M15 13H9" />
    <path d="M21 13h-2" />
    <path d="M15 5H9a2 2 0 0 0-2 2v2h10V7a2 2 0 0 0-2-2z" />
    <path d="M13 18c0 .6-.4 1-1 1s-1-.4-1-1v-4h2v4z" />
  </IconBase>
);
