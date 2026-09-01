import { expect, test } from "vitest";
import { matchesYapperSearch } from "../src/lib/yapperSearch";

const wei = { handle: "_weihup", displayName: "Wei Hup" };

test("empty and whitespace terms match everyone", () => {
  expect(matchesYapperSearch("", wei)).toBe(true);
  expect(matchesYapperSearch("   ", wei)).toBe(true);
});

test("strips a leading @ and matches handle or display name", () => {
  expect(matchesYapperSearch("@_weihup", wei)).toBe(true);
  expect(matchesYapperSearch("WEI", wei)).toBe(true);
  expect(matchesYapperSearch("hup", wei)).toBe(true);
  expect(matchesYapperSearch("nobodyhere", wei)).toBe(false);
});
