import { Blocks, BrainCircuit, ChartLine, Cloud, Database, Layers, LayoutTemplate, PenTool, Server, ShieldCheck, Smartphone, Workflow } from "lucide-react";

// The 12 career roles (values must match ROLE_DEFINITIONS in ml-service/app.py and ROADMAP_ROLES in server.js).
export const ROLES = [
  { value: "fullstack developer",    label: "Fullstack developer",    icon: Layers },
  { value: "frontend developer",     label: "Frontend developer",     icon: LayoutTemplate },
  { value: "backend developer",      label: "Backend developer",      icon: Server },
  { value: "data scientist",         label: "Data scientist",         icon: ChartLine },
  { value: "devops engineer",        label: "DevOps engineer",        icon: Workflow },
  { value: "ml engineer",            label: "ML engineer",            icon: BrainCircuit },
  { value: "mobile developer",       label: "Mobile developer",       icon: Smartphone },
  { value: "cloud architect",        label: "Cloud architect",        icon: Cloud },
  { value: "cybersecurity analyst",  label: "Cybersecurity analyst",  icon: ShieldCheck },
  { value: "ui/ux designer",         label: "UI/UX designer",         icon: PenTool },
  { value: "database administrator", label: "Database administrator", icon: Database },
  { value: "blockchain developer",   label: "Blockchain developer",   icon: Blocks },
];

// Options for the Analyze page, where the role is optional.
export const TARGET_ROLES = [{ value: "", label: "Auto-detect best match" }, ...ROLES];

const BY_VALUE = Object.fromEntries(ROLES.map((role) => [role.value, role]));
// Roles reported by older analyses (e.g. "cloud engineer") still get a readable label and an icon.
export const roleLabel = (value) => BY_VALUE[value]?.label || (value ? value.charAt(0).toUpperCase() + value.slice(1) : "");
export const roleIcon = (value) => BY_VALUE[value]?.icon || Layers;
