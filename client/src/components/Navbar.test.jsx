import { fireEvent, render, screen, within } from "@testing-library/react";
import Navbar from "./Navbar";

jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { name: "Test User" }, logout: jest.fn() }) }));

const ORDER = ["Dashboard", "Analyze", "History", "JD Match", "Roadmap", "Resume Builder", "Interview", "About"];

test("desktop and mobile menus list the same pages in order; the menu collapses below lg", () => {
  const onNavigate = jest.fn();
  render(<Navbar onNavigate={onNavigate} currentPage="interview" />);
  const desktop = screen.getByTestId("desktop-nav");
  // Hidden below 1024px (Tailwind lg); the menu button is shown only there.
  expect(desktop).toHaveClass("hidden", "lg:flex");
  const links = within(desktop).getAllByRole("button").map((button) => button.textContent).slice(0, ORDER.length);
  expect(links).toEqual(ORDER);
  expect(within(desktop).getByRole("button", { name: "Interview" })).toHaveAttribute("aria-current", "page");
  for (const label of ORDER) expect(within(desktop).getByRole("button", { name: label })).toHaveClass("whitespace-nowrap");

  const toggle = screen.getByRole("button", { name: "Open menu" });
  expect(toggle).toHaveClass("lg:hidden");
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle);
  expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
  const mobile = screen.getByTestId("mobile-nav");
  expect(mobile).toHaveClass("lg:hidden");
  expect(within(mobile).getAllByRole("button").map((button) => button.textContent))
    .toEqual([...ORDER, "Profile", "Logout"]);
  fireEvent.click(within(mobile).getByRole("button", { name: "Resume Builder" }));
  expect(onNavigate).toHaveBeenCalledWith("resume-builder");
  expect(screen.queryByTestId("mobile-nav")).not.toBeInTheDocument();
});
