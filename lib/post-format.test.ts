import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPostText, type Block, type Inline } from "./post-format.ts";
import { parsePostText } from "./post-segments.ts";

const segment = (text: string) => parsePostText(text, { tradeable: ["BTC"] });

const show = (nodes: Inline[]): string =>
  nodes
    .map((node) => {
      if (node.kind === "text") return node.value;
      if (node.kind === "segment") return `[${node.segment.kind}:${node.segment.value}]`;
      if (node.kind === "code") return `<code>${node.value}</code>`;
      return `<${node.kind}>${show(node.children)}</${node.kind}>`;
    })
    .join("");

/** The text as one paragraph, its lines joined back with newlines. */
const one = (text: string) => {
  const blocks = formatPostText(text, segment);
  assert.equal(blocks.length, 1, `expected one block for ${JSON.stringify(text)}`);
  const block = blocks[0]!;
  assert.equal(block.kind, "paragraph");
  return (block as Extract<Block, { kind: "paragraph" }>).lines.map(show).join("\n");
};

describe("plain text is untouched", () => {
  it("keeps every line, blank ones included", () => {
    assert.equal(one("hello\n\n\nworld\n"), "hello\n\n\nworld\n");
  });

  it("leaves snake_case, maths and lone markers as written", () => {
    assert.equal(one("my_var_name stays"), "my_var_name stays");
    assert.equal(one("2 * 3 * 4 and 2*3*4"), "2 * 3 * 4 and 2*3*4");
    assert.equal(one("a **b and c~~"), "a **b and c~~");
    assert.equal(one("-5 degrees, 1.5 million"), "-5 degrees, 1.5 million");
  });

  it("holds a literal private-use character as itself", () => {
    assert.equal(one("x\uE000y"), "x\uE000y");
  });
});

describe("inline formatting", () => {
  it("reads bold, italic, strike and code", () => {
    assert.equal(one("this is **big** news"), "this is <strong>big</strong> news");
    assert.equal(one("*soft* and _quiet_"), "<em>soft</em> and <em>quiet</em>");
    assert.equal(one("~~old~~ new"), "<strike>old</strike> new");
    assert.equal(one("run `npm i` now"), "run <code>npm i</code> now");
  });

  it("nests italic inside bold", () => {
    assert.equal(one("**very _much_ so**"), "<strong>very <em>much</em> so</strong>");
  });

  it("treats nothing inside backticks as formatting", () => {
    assert.equal(one("`**raw** @bob`"), "<code>**raw** @bob</code>");
  });

  it("writes a literal marker after a backslash", () => {
    assert.equal(one("\\*not italic\\*"), "*not italic*");
  });
});

describe("links, mentions and tags survive formatting", () => {
  it("never breaks a handle or a URL on its underscores", () => {
    assert.equal(one("hi @some_user_name"), "hi [mention:@some_user_name]");
    assert.equal(one("see https://example.com/a_b_c"), "see [url:https://example.com/a_b_c]");
  });

  it("bolds a sentence around a mention and a cashtag", () => {
    assert.equal(one("**@bob bought $BTC**"), "<strong>[mention:@bob] bought [cashtag:$BTC]</strong>");
  });

  it("gives the closing marker back when a URL swallowed it", () => {
    assert.equal(one("**https://example.com/x**"), "<strong>[url:https://example.com/x]</strong>");
  });
});

describe("blocks", () => {
  it("reads a bullet list between paragraphs, without doubling the gaps", () => {
    const blocks = formatPostText("Top picks:\n\n- one\n- **two**\n\nDone", segment);
    assert.deepEqual(blocks.map((b) => b.kind), ["paragraph", "list", "paragraph"]);
    const [intro, list, outro] = blocks as [
      Extract<Block, { kind: "paragraph" }>,
      Extract<Block, { kind: "list" }>,
      Extract<Block, { kind: "paragraph" }>,
    ];
    assert.deepEqual(intro.lines.map(show), ["Top picks:"]);
    assert.equal(list.ordered, false);
    assert.deepEqual(list.items.map(show), ["one", "<strong>two</strong>"]);
    assert.deepEqual(outro.lines.map(show), ["Done"]);
  });

  it("numbers an ordered list from its first number", () => {
    const [list] = formatPostText("3. c\n4) d", segment) as [Extract<Block, { kind: "list" }>];
    assert.equal(list.kind, "list");
    assert.equal(list.ordered, true);
    assert.equal(list.start, 3);
    assert.deepEqual(list.items.map(show), ["c", "d"]);
  });

  it("keeps a year at the start of a sentence as a sentence", () => {
    assert.equal(one("2026. What a year"), "2026. What a year");
  });

  it("reads a quote", () => {
    const [quote] = formatPostText("> said it\n> _twice_", segment) as [Extract<Block, { kind: "quote" }>];
    assert.equal(quote.kind, "quote");
    assert.deepEqual(quote.lines.map(show), ["said it", "<em>twice</em>"]);
  });
});
