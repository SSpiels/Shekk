import { describe, expect, it } from "vitest";
import { extractPageText } from "./events-price-enrichment.server";
import { parsePriceFromText } from "./events-price";

describe("extractPageText", () => {
  it("strips inline <script> source — real bug: jQuery's \"$1\" regex backreference read as a price", () => {
    const html = `
      <html><body>
        <script>$(document).ready(function () { el.replace(/(\\w+)/, "$1"); });</script>
        <h1>Outback Garage Bike Fest</h1>
        <p>A day of bikes, music and community at Teder.</p>
      </body></html>
    `;
    const text = extractPageText(html);
    expect(text).not.toContain("$1");
    expect(text).toContain("Outback Garage Bike Fest");
    // The real regression: this used to parse as paid_unknown (note "$1") from script noise alone.
    expect(parsePriceFromText(text)).toBeNull();
  });

  it("strips <style> content too", () => {
    const html = `<html><head><style>.price::before { content: "$5"; }</style></head><body><p>No price here.</p></body></html>`;
    const text = extractPageText(html);
    expect(text).not.toContain("$5");
  });

  it("keeps real visible price text", () => {
    const html = `<html><body><p>Cost: NIS69.00</p></body></html>`;
    const text = extractPageText(html);
    expect(parsePriceFromText(text)).toEqual({ kind: "exact", amountAgorot: 6900, maxAmountAgorot: null, note: null });
  });
});
