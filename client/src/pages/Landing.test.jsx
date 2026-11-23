import { fireEvent, render, screen, within } from "@testing-library/react";
import Landing from "./Landing";

test("one headline, one primary sign-in, three feature blocks, a product screenshot and the team credit", () => {
  const onSignIn = jest.fn();
  const scrollIntoView = jest.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  const { container } = render(<Landing onSignIn={onSignIn} />);

  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("See where your resume stands, and what to do next");
  // The supporting copy is one sentence (no "you.." double period).
  expect(screen.getByText(/^Upload your resume to get an ATS score/)).toHaveTextContent(/^[^.]+\.$/);

  const [topBar, hero] = screen.getAllByRole("button", { name: "Continue with Google" });
  expect(topBar.className).toContain("bg-surface");   // secondary in the top bar
  expect(hero.className).toContain("bg-brand");       // the only primary button
  expect(container.querySelectorAll("button.bg-brand")).toHaveLength(1);
  fireEvent.click(topBar);
  fireEvent.click(hero);
  expect(onSignIn).toHaveBeenCalledTimes(2);

  fireEvent.click(screen.getByRole("button", { name: "See how it works" }));
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("features"));

  const features = screen.getByRole("region", { name: "How it works" });
  expect(within(features).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Analyze", "Improve", "Prepare"]);
  expect(screen.getByRole("img", { name: /dashboard with ATS score/ })).toHaveAttribute("src", "/product-dashboard.jpg");

  const footer = screen.getByRole("contentinfo");
  expect(footer).toHaveTextContent("Built by Avi Mishra.");

  // No emoji, uppercase badge or serif accents.
  // (© is "pictographic" in Unicode, so match emoji by presentation and the emoji variation selector.)
  expect(container.textContent).not.toMatch(/\p{Emoji_Presentation}|️/u);
  expect(screen.queryByText(/AI-POWERED CAREER GUIDANCE/i)).not.toBeInTheDocument();
  expect(container.querySelector("[style*='Instrument Serif']")).toBeNull();
});
