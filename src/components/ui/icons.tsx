'use client';

import { clsx } from 'clsx';

interface IconProps {
  className?: string;
  strokeWidth?: number;
}

const base = 'h-[18px] w-[18px]';

export function SearchIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

export function UserIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
    </svg>
  );
}

export function HeartIcon({ className, strokeWidth = 1.4, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M12 20s-7.5-4.4-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6c0 5-7.5 9.4-7.5 9.4Z" strokeLinejoin="round" />
    </svg>
  );
}

export function BagIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M6 8h12l-1 12H7L6 8Z" strokeLinejoin="round" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export function HomeIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4v-9.5Z" strokeLinejoin="round" />
    </svg>
  );
}

export function GridIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" />
      <rect x="13" y="4" width="7" height="7" />
      <rect x="4" y="13" width="7" height="7" />
      <rect x="13" y="13" width="7" height="7" />
    </svg>
  );
}

export function FilterIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronDown({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronLeft({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="m14 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRight({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="m10 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRight({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M5 12h14m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrashIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.94.55 3.75 1.5 5.28L2 22l5-1.63a9.8 9.8 0 0 0 5.04 1.38c5.44 0 9.84-4.4 9.84-9.84S17.48 2 12.04 2Zm0 17.94c-1.6 0-3.1-.44-4.4-1.2l-.32-.2-3.1 1 1.02-3-.2-.33a7.98 7.98 0 0 1-1.24-4.27 8.1 8.1 0 0 1 8.24-8.1 8.1 8.1 0 0 1 8.1 8.1 8.1 8.1 0 0 1-8.1 8.1Zm4.5-6.06c-.25-.13-1.46-.72-1.68-.8-.23-.08-.4-.13-.56.12-.17.25-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.04-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.39.11-.51.11-.11.25-.29.37-.44.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.22.25-.86.84-.86 2.05 0 1.2.88 2.37 1 2.53.12.17 1.73 2.64 4.2 3.7.58.26 1.04.4 1.4.52.58.19 1.11.16 1.53.1.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.14-1.17-.06-.1-.22-.17-.47-.29Z" />
    </svg>
  );
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon({ className }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 3c.3 2 1.6 3.5 3.5 3.8v2.4c-1.3.1-2.5-.3-3.6-1v6.1a5.6 5.6 0 1 1-5.6-5.6c.3 0 .5 0 .8.1v2.5a3.1 3.1 0 1 0 2.3 3V3h2.6Z" />
    </svg>
  );
}

export function GlobeIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5s-1.1 6.1-3.3 8.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5Z" />
    </svg>
  );
}

export function ZoomIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5M11 8.5v5M8.5 11h5" strokeLinecap="round" />
    </svg>
  );
}

export function PackageIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" strokeLinejoin="round" />
      <path d="M4 8.5 12 13l8-4.5M12 13v7" strokeLinejoin="round" />
    </svg>
  );
}

export function BellIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5Z" strokeLinejoin="round" />
      <path d="M10 18.5a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

export function RulerIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <rect x="3" y="8.5" width="18" height="7" rx="1" />
      <path d="M7 8.5v3M11 8.5v4M15 8.5v3M19 8.5v4" strokeLinecap="round" />
    </svg>
  );
}

export function MapPinIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M12 21s-6.5-5.5-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.5 12 21 12 21Z" strokeLinejoin="round" />
      <circle cx="12" cy="10.5" r="2.3" />
    </svg>
  );
}

export function TruckIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M2 7.5h11v9H2zM13 10.5h4.5l3 3v3H13z" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </svg>
  );
}

export function SparkIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M18.4 5.6l-4.2 4.2M9.8 14.2l-4.2 4.2" strokeLinecap="round" />
    </svg>
  );
}

export function ShieldIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.2-2.9 7.5-7 9-4.1-1.5-7-4.8-7-9V6l7-3Z" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <rect x="4.5" y="10" width="15" height="10.5" rx="1.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" strokeLinecap="round" />
    </svg>
  );
}

export function MailIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="m3.5 6.5 8.5 6 8.5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PhoneIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M6 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 5.7 2 2 0 0 1 6 3.5Z" strokeLinejoin="round" />
    </svg>
  );
}

export function CopyIcon({ className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" />
      <path d="M15.5 5.5h-11v11" strokeLinecap="round" />
    </svg>
  );
}
