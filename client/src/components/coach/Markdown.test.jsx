import { render, screen } from "@testing-library/react";
import Markdown, { parseBlocks } from "./Markdown";

test("parses paragraphs, bullet and numbered lists, and headings", () => {
  expect(parseBlocks("Intro line\nsecond line\n\n- one\n* two\n• three\n\n### Next steps\n1. first\n2. second")).toEqual([
    { type: "p", lines: ["Intro line", "second line"] },
    { type: "ul", items: ["one", "two", "three"], start: undefined },
    { type: "h", text: "Next steps" },
    { type: "ol", items: ["first", "second"], start: 1 },
  ]);
});

test("inline bold, italics and code; arithmetic asterisks and HTML stay plain text", () => {
  const { container } = render(<Markdown text={"Use **cache-aside** with *TTL* and `redis-cli`. 5 * 3 = 15. <b>not bold</b>"} />);
  expect(screen.getByText("cache-aside").tagName).toBe("STRONG");
  expect(screen.getByText("TTL").tagName).toBe("EM");
  expect(screen.getByText("redis-cli").tagName).toBe("CODE");
  expect(container.textContent).toContain("5 * 3 = 15.");
  expect(container.querySelector("b")).toBeNull();
  expect(container.textContent).toContain("<b>not bold</b>");
});
