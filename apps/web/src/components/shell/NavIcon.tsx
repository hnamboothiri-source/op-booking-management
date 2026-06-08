/**
 * Minimal stroke icons for the sidebar, keyed by name. Hand-rolled inline SVG
 * (the project has no icon library) following the same pattern as KindIcon in
 * PatientTimeline.tsx.
 */
export type IconName =
  | "dashboard" | "leads" | "headset" | "phone" | "target" | "calendar"
  | "hourglass" | "queue" | "stethoscope" | "bed" | "patients" | "bell"
  | "referral" | "tent" | "truck" | "message" | "building" | "megaphone"
  | "heart" | "tasks" | "chart" | "report" | "sliders" | "shield";

export function NavIcon({ name, className = "h-[18px] w-[18px]" }: { name: IconName; className?: string }) {
  const p = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "dashboard": return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>;
    case "leads": return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 11l-3-3-3 3" /></svg>;
    case "headset": return <svg {...p}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="2" y="14" width="5" height="6" rx="1.5" /><rect x="17" y="14" width="5" height="6" rx="1.5" /><path d="M20 20a4 4 0 0 1-4 3h-2" /></svg>;
    case "phone": return <svg {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>;
    case "target": return <svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>;
    case "calendar": return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
    case "hourglass": return <svg {...p}><path d="M6 2h12M6 22h12M8 2v4.2c0 .5.2 1 .6 1.4L12 12l3.4-4.4c.4-.4.6-.9.6-1.4V2M8 22v-4.2c0-.5.2-1 .6-1.4L12 12l3.4 4.4c.4.4.6.9.6 1.4V22" /></svg>;
    case "queue": return <svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>;
    case "stethoscope": return <svg {...p}><path d="M4 3v5a4 4 0 0 0 8 0V3" /><path d="M8 17a5 5 0 0 0 10 0v-2" /><circle cx="18" cy="11" r="2" /></svg>;
    case "bed": return <svg {...p}><path d="M3 20V8l9-5 9 5v12" /><path d="M9 20v-5h6v5M12 9v3M10.5 10.5h3" /></svg>;
    case "patients": return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>;
    case "bell": return <svg {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>;
    case "referral": return <svg {...p}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>;
    case "tent": return <svg {...p}><path d="M3.5 21 12 4l8.5 17M12 4v17M12 21l-4-7M12 21l4-7" /></svg>;
    case "truck": return <svg {...p}><path d="M1 4h14v11H1z" /><path d="M15 8h4l3 3v4h-7z" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>;
    case "message": return <svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-4-1L3 20l1.1-4.9A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" /></svg>;
    case "building": return <svg {...p}><rect x="4" y="2" width="16" height="20" rx="1" /><path d="M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 22v-4h4v4" /></svg>;
    case "megaphone": return <svg {...p}><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M15 8a5 5 0 0 1 0 8" /></svg>;
    case "heart": return <svg {...p}><path d="M19 14c1.5-1.5 3-3.2 3-5.5A3.5 3.5 0 0 0 15.5 6 3.5 3.5 0 0 0 9 8.5c0 2.3 1.5 4 3 5.5l3.5 3.5z" /></svg>;
    case "tasks": return <svg {...p}><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg>;
    case "chart": return <svg {...p}><path d="M3 3v18h18" /><path d="M7 14v4M12 9v9M17 5v13" /></svg>;
    case "report": return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg>;
    case "sliders": return <svg {...p}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>;
    case "shield": return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
  }
}
