import { fireEvent, render, screen } from "@testing-library/react";
import About from "./About";
import Profile from "./Profile";

const mockLogout = jest.fn();
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { name: "Rahul Verma", email: "rahul.verma@example.com" }, logout: mockLogout }) }));

test("About credits the builder, and explains the score honestly", () => {
  const { container } = render(<About />);
  const team = screen.getByRole("region", { name: "Team" });
  expect(team).toHaveTextContent("Built by Avi Mishra.");
  expect(screen.getByRole("region", { name: "How scoring works" })).toHaveTextContent("not as a prediction of any employer's applicant tracking system");
  // Only libraries the code actually uses; no emoji, serif accents or invented numbers.
  expect(screen.getByRole("region", { name: "Tech stack" })).not.toHaveTextContent(/bcrypt|Nodemailer/);
  expect(container.textContent).not.toMatch(/\p{Emoji_Presentation}|️/u);
  expect(container.querySelector("[style*='Instrument Serif']")).toBeNull();
});

test("Profile shows the account and logs out", () => {
  render(<Profile />);
  expect(screen.getByRole("region", { name: "Account" })).toHaveTextContent("rahul.verma@example.com");
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  expect(mockLogout).toHaveBeenCalled();
});
