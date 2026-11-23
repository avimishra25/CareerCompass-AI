import React from "react";

// A small Markdown subset for coach replies, rendered as React elements (never as HTML), so
// model output cannot inject markup. Blocks: paragraphs, "-"/"*"/"•" bullet lists, "1." numbered
// lists, "#" headings. Inline: **bold**, *italic*, `code`. Anything else is shown as plain text.
const INLINE = /(\*\*(?=\S)(.+?)(?<=\S)\*\*)|(\*(?=\S)([^*]+?)(?<=\S)\*)|(`([^`]+)`)/g;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

export function renderInline(text, keyPrefix = "") {
  const parts = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const key = `${keyPrefix}${index++}`;
    if (match[1]) parts.push(<strong key={key} className="font-semibold">{renderInline(match[2], `${key}-`)}</strong>);
    else if (match[3]) parts.push(<em key={key}>{renderInline(match[4], `${key}-`)}</em>);
    else parts.push(<code key={key} className="rounded-sm bg-hover px-1 text-[0.95em]">{match[6]}</code>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function parseBlocks(text) {
  const blocks = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "p", lines: paragraph });
    paragraph = [];
  };
  for (const line of (text || "").replace(/\r\n?/g, "\n").split("\n")) {
    const bullet = line.match(BULLET);
    const numbered = !bullet && line.match(NUMBERED);
    const heading = !bullet && !numbered && line.match(HEADING);
    const list = bullet ? "ul" : numbered ? "ol" : null;
    if (list) {
      flush();
      const previous = blocks[blocks.length - 1];
      const item = bullet ? bullet[1] : numbered[2];
      if (previous?.type === list) previous.items.push(item);
      else blocks.push({ type: list, items: [item], start: numbered ? Number(numbered[1]) : undefined });
    } else if (heading) {
      flush();
      blocks.push({ type: "h", text: heading[1] });
    } else if (!line.trim()) {
      flush();
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

export default function Markdown({ text }) {
  return (
    <div className="space-y-2">
      {parseBlocks(text).map((block, index) => {
        if (block.type === "ul" || block.type === "ol") {
          const List = block.type;
          return (
            <List key={index} start={block.start} className={block.type === "ul" ? "ml-4 list-disc space-y-1" : "ml-5 list-decimal space-y-1"}>
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `${index}-${itemIndex}-`)}</li>)}
            </List>
          );
        }
        if (block.type === "h") return <p key={index} className="font-semibold">{renderInline(block.text, `${index}-`)}</p>;
        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <React.Fragment key={lineIndex}>{lineIndex > 0 && <br />}{renderInline(line, `${index}-${lineIndex}-`)}</React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
