import { fireEvent, render, screen } from "@testing-library/react";
import About from "./About";
import Profile from "./Profile";

const mockLogout = jest.fn();
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { name: "Rahul Verma", email: "rahul.verma@example.com" }, logout: mockLogout }) }));

test("About credits the team and mentor, and explains the score honestly", () => {
  const { container } = render(<About />);
  const team = screen.getByRole("region", { name: "Team" });
  expect(team).toHaveTextContent("Avi Akhilesh Mishra (23BCP266)");
  expect(team).toHaveTextContent("Harshil Himanshubhai Khara (23BCP249)");
  expect(team).toHaveTextContent("Under the guidance of Dr. Darshit Shah, Assistant Professor, Department of Computer Science & Engineering, School of Technology, PDEU.");
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
