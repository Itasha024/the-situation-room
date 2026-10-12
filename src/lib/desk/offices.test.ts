/** Who holds which office (user, 12 Oct: Burnham is the Prime Minister). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rightOffice } from "./offices.ts";

test("a UK office before a holder's name is the holder's own", () => {
  assert.equal(rightOffice("UK Home Secretary Andy Burnham: RAF Fairford incident almost certainly directed by Iran's IRGC"), "UK Prime Minister Andy Burnham: RAF Fairford incident almost certainly directed by Iran's IRGC");
  assert.equal(rightOffice("Foreign Secretary Yvette Cooper said"), "Health Secretary Yvette Cooper said");
  assert.equal(rightOffice("Defence Secretary John Healey"), "Chancellor John Healey");
  // Right already, or another way of saying it: as it is.
  assert.equal(rightOffice("UK PM Burnham: sanctions on the IRGC"), "UK PM Burnham: sanctions on the IRGC");
  assert.equal(rightOffice("Home Secretary Shabana Mahmood"), "Home Secretary Shabana Mahmood");
  assert.equal(rightOffice("Deputy Prime Minister Louise Haigh"), "Deputy Prime Minister Louise Haigh");
  assert.equal(rightOffice("Prime Minister Netanyahu"), "Prime Minister Netanyahu");
});
