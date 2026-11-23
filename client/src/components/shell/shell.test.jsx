import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import AppShell from "./AppShell";
import { AppDataProvider } from "../../context/AppDataContext";

jest.mock("axios");

const user = { name: "Rahul Verma", email: "rahul.verma@example.com" };
const latest = { _id: "a1", skills: ["react", "node"], atsScore: 72, bestRole: { role: "fullstack developer" }, match: {}, mlInsights: null };

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("token", "test-token");
  Element.prototype.scrollIntoView = jest.fn();
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/api/history") ? [latest] : {} }));
});

// Renders, then lets the shared history and coach summary requests settle inside act().
const renderShell = async (props = {}) => {
  const handlers = { onNavigate: jest.fn(), onLogout: jest.fn() };
  const utils = render(
    <AppDataProvider>
      <AppShell currentPage="dashboard" user={user} {...handlers} {...props}><p>Page body</p></AppShell>
    </AppDataProvider>,
  );
  await act(async () => {});
  return { ...utils, ...handlers };
};
const mainNav = () => screen.getAllByRole("navigation", { name: "Main" })[0];

test("sidebar groups pages, marks the current one, and has no Jobs entry", async () => {
  const { onNavigate } = await renderShell({ currentPage: "compare" });
  const nav = mainNav();
  const groups = within(nav).getAllByRole("list").map((list) => [list.getAttribute("aria-label") || within(nav).getByText(list.previousSibling?.textContent || "x").textContent,
    within(list).getAllByRole("button").map((button) => button.textContent)]);
  expect(groups).toEqual([
    ["Overview", ["Dashboard"]],
    ["Analyze", ["Resume analysis", "JD match", "History"]],
    ["Improve", ["Roadmap", "Resume builder"]],
    ["Prepare", ["Interview prep"]],
    ["More", ["About"]],
  ]);
  expect(screen.queryByText(/jobs/i)).not.toBeInTheDocument();
  // Compare lives under History.
  expect(within(nav).getByRole("button", { name: "History" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(within(nav).getByRole("button", { name: "Roadmap" }));
  expect(onNavigate).toHaveBeenCalledWith("roadmap");
  expect(screen.getByText("Page body")).toBeInTheDocument();
});

test("arrow keys, Home and End move focus through the sidebar", async () => {
  await renderShell();
  const nav = mainNav();
  const dashboard = within(nav).getByRole("button", { name: "Dashboard" });
  dashboard.focus();
  fireEvent.keyDown(dashboard, { key: "ArrowDown" });
  expect(within(nav).getByRole("button", { name: "Resume analysis" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: "End" });
  expect(within(nav).getByRole("button", { name: "About" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: "ArrowDown" });
  expect(dashboard).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: "ArrowUp" });
  expect(within(nav).getByRole("button", { name: "About" })).toHaveFocus();
});

test("the sidebar collapses to icons with tooltips and remembers it", async () => {
  const { unmount } = await renderShell();
  fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
  const nav = mainNav();
  const roadmap = within(nav).getByRole("button", { name: "Roadmap" });
  expect(roadmap).not.toHaveTextContent("Roadmap");
  expect(roadmap).toHaveAccessibleDescription("Roadmap");
  expect(localStorage.getItem("cc.sidebarCollapsed")).toBe("1");
  unmount();
  await renderShell();
  expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
});

test("below 1024px the menu opens a drawer: focus moves in, Esc closes and returns focus", async () => {
  const { onNavigate } = await renderShell();
  const menu = screen.getByRole("button", { name: "Open navigation" });
  expect(menu).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(menu);
  const drawer = screen.getByRole("dialog", { name: "Navigation" });
  expect(within(drawer).getByRole("button", { name: "Dashboard" })).toHaveFocus();
  expect(menu).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(drawer, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() => expect(menu).toHaveFocus());
  fireEvent.click(menu);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "JD match" }));
  expect(onNavigate).toHaveBeenCalledWith("jd-match");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("top bar: breadcrumb, New analysis, and the career coach panel toggle", async () => {
  const { onNavigate, rerender } = await renderShell({ currentPage: "jd-match" });
  const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
  expect(within(crumbs).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Analyze", "JD match"]);
  fireEvent.click(screen.getByRole("button", { name: "New analysis" }));
  expect(onNavigate).toHaveBeenCalledWith("analyze");

  const coachToggle = screen.getByRole("button", { name: "Career coach" });
  expect(screen.queryByRole("complementary", { name: "Career coach" })).not.toBeInTheDocument();
  fireEvent.click(coachToggle);
  expect(coachToggle).toHaveAttribute("aria-expanded", "true");
  const panel = screen.getByRole("complementary", { name: "Career coach" });
  // The coach uses the latest saved analysis from the shared history.
  expect(await within(panel).findByText("Uses your latest analysis")).toBeInTheDocument();
  expect(within(panel).getByText("ATS 72/100")).toBeInTheDocument();
  expect(axios.get.mock.calls.filter(([url]) => url.endsWith("/api/history"))).toHaveLength(1);
  fireEvent.click(within(panel).getByRole("button", { name: "Close career coach" }));
  expect(coachToggle).toHaveAttribute("aria-expanded", "false");

  rerender(<AppDataProvider><AppShell currentPage="compare" user={user} onNavigate={onNavigate} onLogout={jest.fn()} /></AppDataProvider>);
  await act(async () => {});
  fireEvent.click(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByRole("button", { name: "History" }));
  expect(onNavigate).toHaveBeenLastCalledWith("history");
});

test("user menu offers Profile and Log out; Esc closes it and returns focus", async () => {
  const { onNavigate, onLogout } = await renderShell();
  const trigger = screen.getAllByRole("button", { name: "Account: Rahul Verma" })[0];
  fireEvent.click(trigger);
  const menu = screen.getByRole("menu", { name: "Account" });
  expect(within(menu).getByRole("menuitem", { name: "Profile" })).toHaveFocus();
  fireEvent.keyDown(menu, { key: "ArrowDown" });
  expect(within(menu).getByRole("menuitem", { name: "Log out" })).toHaveFocus();
  fireEvent.keyDown(menu, { key: "Escape" });
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("menuitem", { name: "Profile" }));
  expect(onNavigate).toHaveBeenCalledWith("profile");
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));
  expect(onLogout).toHaveBeenCalled();
});
