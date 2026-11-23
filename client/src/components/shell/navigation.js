import { FilePen, FileSearch, History, Info, LayoutDashboard, Map, MessagesSquare, Target } from "lucide-react";

// Sidebar groups. To add a page: add it here, add its `currentPage` branch in App.js.
export const NAV_GROUPS = [
  { label: "Overview", items: [{ page: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Analyze",
    items: [
      { page: "analyze", label: "Resume analysis", icon: FileSearch },
      { page: "jd-match", label: "JD match", icon: Target },
      { page: "history", label: "History", icon: History },
    ],
  },
  {
    label: "Improve",
    items: [
      { page: "roadmap", label: "Roadmap", icon: Map },
      { page: "resume-builder", label: "Resume builder", icon: FilePen },
    ],
  },
  { label: "Prepare", items: [{ page: "interview", label: "Interview prep", icon: MessagesSquare }] },
];
export const NAV_BOTTOM = [{ page: "about", label: "About", icon: Info }];

// Breadcrumb for the top bar: [group, page] or [page]. Compare lives under History.
const META = {
  profile: { trail: ["Profile"] },
  compare: { trail: ["History", "Compare"], parent: "history" },
};
for (const group of NAV_GROUPS) for (const item of group.items) META[item.page] = { trail: [group.label, item.label] };
for (const item of NAV_BOTTOM) META[item.page] = { trail: [item.label] };
META.home = META.dashboard;

export const pageMeta = (page) => META[page] || META.dashboard;
// The sidebar item highlighted for a page (Compare highlights History).
export const activeNavPage = (page) => (page === "home" ? "dashboard" : META[page]?.parent || page);
