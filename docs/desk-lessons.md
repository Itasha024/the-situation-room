# Desk lessons

The log of what the operator and the reviews found wrong, and what now handles each mistake. Every rule has a test named after its case. Read this before changing the gate, the reader, the fold or the incident tables.

## Round 28: the operator's review of 3 Oct, and every card from 3 to 5 Oct

**Sources:**
- The operator's notes of 3 Oct, and their clarifications of 5 Oct.
- A card-by-card review of all 1,298 cards published from Sat 3 Oct 00:00 to Mon 5 Oct 19:05 (Israel time), in eight slices. Each judgement was checked against the source post. The findings are in `docs/review-2026-10-05/`; slices 1, 5 and 8 came back as summaries in the session.
- A row-by-row check of the energy and maritime tables (`docs/review-2026-10-05/ledger-findings.md`).

**Scale:** about 690 of the 1,298 cards (53%) had a mistake. About 345 of those were the same event carded again.

| Mistake class | Cards | Share of the 690 |
|---|---|---|
| Duplicate | ≈344 | 50% |
| Relay instead of the original | ≈70 | 10% |
| Headline or body not in the linked post | ≈50 | 7% |
| "Also" holding other events | ≈50 | 7% |
| Wrong side | ≈30 | 4% |
| Attribution | ≈30 | 4% |
| Recap | ≈20 | 3% |

The operator's clarifications (5 Oct) bound the rules:
- A side's count over a period, of what it launched or struck or of what the other side did, is wanted.
- No category is banned (rates, appointments); a card is judged on whether it tells something new about the war or its effects.
- A video can make a long card when what is said is news; the mistake is transcribing it.
- The same Saudi facility can be hit more than once a day.
- A non-aligned outlet counts as its own for the map even when it quotes a side.

### 1. One event, many cards

The biggest failure by far. It showed up in five forms:
- one channel posting the same event again and again (Ali Bk: ten cards on the Riyadh smoke of 3 Oct; 09:55 + 10:00);
- many outlets on one wave of strikes (Sanaa, 3 Oct 13:00 to 14:00);
- one speech or statement carded line by line: al-Alimi about 45 cards; the government spokesman's 18:00 statement 9; al-Maliki's 21:15 statement about 16; Abdulsalam's one post 6; a single interview 5;
- a post that already sat in an earlier card's "Also" leading a new card;
- the same Reuters story in French and Portuguese.

Now (`yemen-scan.server.ts` `foldIntoPublished`, `combine.ts`):
- **A channel's own repeat** with nothing new joins its first card, within 4 hours, when the reader says `duplicate_of`, or it is the same event abroad, or the same field event on the same spot. Its sirens, "again", "a new wave" and "a second strike" stay their own cards.
- **A wave of air strikes** on one place named by several outlets within 90 minutes is one card; new targets are written into it.
- **A speaker's lines** within 2 hours of the card on his words join it, and what they add is written in. One speech, one statement or one interview is one card.
- **A post already in a card's Also** never leads a card.
- **Translated wire editions** (reuters.com/fr/…, /pt/…) are not read.
- **Never copies:** a denial and the claim it denies; each side taking the same ground (`copies.ts` `opposed`).

Tests: `round28.test.ts` "One event, one card"; `yemen-scan.test.ts` (updated: the interview line, sirens).

### 2. Headlines that are not in the linked post, and "Also" as a dumping ground

The merged write-up took its headline from an account in "Also" (11 cards a day), sometimes reversing the linked post:
- "not a war on Sanaa, Saada…" became "operations in Sanaa, Saada";
- a Houthi denial led a card headed "government forces seize Bab al-Mandab".

Saree's claim on Riyadh only was written as "Riyadh, Yanbu and Abqaiq" from rumours in the group. The capture of Mocha sat in the Also of three unrelated cards before it got its own.

Now (`combine.ts`):
- The write-up's headline must be what account [1], the card's own link, reports (`leadCarries`).
- An account of another event is listed by the model in `other` and goes out as its own card, or leaves the Also.
- One side's claim stays that side's: a place only some accounts name is attributed to them.

### 3. The original source, read in full

**What went wrong:**
- Axios was relayed six times on 3 Oct and led with its headline only. The original was in "Also" while a relay led (07:09).
- Saudi Civil Defence (10:07), the UK minister (10:53, @SDoughtyMP), the human rights minister (10:58, @mashdal), the Taiz military axis (11:11, @axistaiz) and the government armed forces spokesman were all reached second-hand.
- Reuters, AFP, NYT and Bloomberg came through OSINT accounts.

**Now:**
- A card from the original carries no "Also": the lead-swap path no longer keeps relays (`yemen-scan.server.ts`, `store.pg.ts`).
- A party's own post takes a card only when it was posted within 90 minutes of it. A morning card was re-pointed to an evening statement and to an editorial of 20:36 (slice 1).
- The accounts the operator named are read directly (Step 5 of the round).
- Major outlets' articles are read in full (Step 6 of the round).

### 4. Sides: "Yemeni forces"

| Time | Case |
|---|---|
| 3 Oct 14:16 | Ali Bk's "Yemeni forces advance in Al-Shamaytayn" went out as the government's. They were the Houthis. |
| (several) | Press TV's "Sanaa forces" became "Yemeni government forces". |
| (several) | Shajab's "Yemeni armed forces" target Dammam became the government's. |
| (several) | Saree's interception claim became "Houthi and Yemeni government forces report…". |
| (several) | "The Saudi enemy's gatherings" in Ras al-Ara and Bab al-Mandab became "Saudi positions"; they are the government's Giants Brigades and Nation's Shield. |

Checked and not a mistake: 3 Oct 14:10, Al-Aqsa TV. Its post says "forces of the legitimacy", so "government forces" is right.

**Now:**
- **Reader prompt (SIDES):** "Yemeni"/"Yemen" mean the outlet's own side. From a Houthi-aligned or Iranian outlet, "the Yemeni armed forces", "Sanaa forces" and "a Yemeni missile" are the Houthis, and "the Saudi enemy's gatherings" in Yemen are Saudi-backed government forces. A source "to Saba" in Sanaa is Houthi.
- **Code (`editor.ts` `houthiYemeniForces`):** a Houthi-aligned outlet's post that says "Yemeni forces" and has no word of the government side cannot come out as "government forces".
- **The reader is told** when an outlet is Iranian state media. A party's own X account is no longer described as an "OSINT analyst".
- **Groups fixed:**

| Outlet | Was | Now | Evidence |
|---|---|---|---|
| Bin Saeed | government-side | Houthi-aligned | "the Saudi enemy", "the Yemeni armed forces", "the martyr commander Sinwar" |
| Shin Persian | Houthi-aligned | non-aligned | a Persian relay of others' X posts, against the Iranian regime |
| Yemen Human Rights Ministry | non-aligned | government | a government ministry |

### 5. Iranian channels

**What went wrong:**
- Press TV, IRNA, Fars, Mehr, SNN and Nour News relayed Saree's numbers hours late (07:47).
- They posted summaries of the day (09:16).
- They carried US–Iran content, and their own editorial lines were attributed to a "Houthi spokesperson".

**Now (`relevance.ts`):** an Iranian channel retelling Saree, Abdulsalam, Saba, Al-Masirah or the Houthi armed forces and ministries is excluded (`iran-relay`), and so is its round-up of the day (`recap`). Iranian outlets' own reporting on Yemen still passes.

### 6. Recaps and old material

**What went wrong:**
- 13:33 The Cube's map of attacks.
- Yemen Future's round-up of facts already carded.
- Footage of "yesterday's" Riyadh fires shown as new.
- Cumulative totals (the army's "1,747", the coalition's "324 targets") carded again and again.

**Now:**
- The reader prompt has a RECAP rule; a side's own new count stays.
- The fold catches a repeated count at the same place (`sameCountAt`) and a repeated claim with its figure.

### 7. Attribution and speakers

**What went wrong:**
- 10:35 should have been "Yemeni military official: …".
- A tribal sheikh was called an "official".
- A "military source to Saba" was promoted to "spokesperson".
- Houthi-appointed officials (the Hodeidah governor, the envoy in Tehran) were left unlabelled.
- A mocking post was carded as a Houthi official's statement.
- Six cards were credited to Marco Rubio, sharing only "Yemen", "Saudi" and "Houthi" with his words.

**Now:**
- **Reader prompt:** an unnamed official's words are headed with the source, side first ("Yemeni military official: …"). A source is never promoted, and a sheikh is never an official. A sarcastic post is not a statement.
- **`origin.ts`:** a card follows a held speaker report only with the speaker named and three of its distinctive words, or four without his name; the war's common words don't count.

### 8. Video, context, hedges

**What went wrong:**
- 10:08: a full video transcript.
- 09:29: a deployment with no word of why it matters.
- The Cube's "likely by the Houthis" was stated as fact.

**Now (reader prompt):**
- A video is published only for the news in it, written as a piece (no length cap).
- One clause of context is allowed, taken only from the desk's own recent cards.
- The source's hedges stay.

### 9. Links and bodies

**What went wrong:**
- 06:09: the Pakistan report was linked to an unrelated post.
- Google News wrapper links went out.
- Cards had bodies that were only a dateline ("JABAL MAT'HAN — ").

**Now:**
- Dateline-only bodies are dropped (`store.pg.ts`, `wire-style.ts`).
- The Pakistan case was handled on 2 Oct (`originals.ts`).
- Still open: an unresolved Google News link should hold the card longer rather than publish it.

### 10. District control and the developments' maps

**What went wrong:**
- **Jabal Habashi (5 Oct 08:23 UTC)** turned to the government on one compound headline: "…destroy Houthi vehicles in Jabal Habashi, while Houthi forces expel Saudi mobilization from Al-Mawasit district". The capture clause was the Houthis', and in another district. Al Mayadeen, which told only that clause, counted as the second side.
- **All five "ground taken" flags of 5 Oct 12:00 to 18:00 failed the rule:** Dhubab airport, a camp, the security HQ and seized vehicles; Umm Rish camp; "cut the road to East Balaq"; a Taiz "Houthi capture" that was a government advance as the Houthis withdrew; and Anaqib village.
- **A bug:** "capture <Place>" never matched the capture pattern.

**Now:**
- **`control-live.ts`:** a headline is split into clauses. The side, the ground and the district come from one clause, and an outlet in Also counts only for the part its own headline tells. A gathering or reinforcements pushed back is not the holder driven out.
- **Flags (`dev-marks.ts`, `brief-store.ts`, `app.js`):** a flag needs the whole district taken and confirmed (`captureFlag`), stands in that district, and repaints it from its real previous holder. Everything else is an advance. The side named only as withdrawing or fleeing is not the one that advanced.
- **5 Oct, applied by `scripts/fix-map-ledger-1005.mts`:**
  - Jabal Habashi goes back to contested.
  - Al-Mawasit turns contested (Houthi forces entering Al-Ayn town).
  - Dhubab stays the government's: the operator's ruling; Mayun island, inside the district, was reported besieged.

### 11. Energy and maritime tables

**What went wrong:**
- **The 3 Oct attack on Aramco in Riyadh** made nine rows. The desk built a row from each wording: "Aramco refinery in Riyadh", "oil site in Riyadh", "Aramco facilities and refinery in Riyadh"…
- **4 Oct** made seven rows, and 5 Oct two pipeline rows that retold 4 Oct.
- **Reuters' 3 Oct Riyadh fire** was filed under Yanbu on 4 Oct.
- **Confirmations, satellite pictures and responses** counted as attacks: 21 Sep (19 Sep's), 27 Sep (24 Sep's, posted 29 Sep), 2 Oct (a council's condemnation of the Taibah strike, and the 1 Oct Yanbu strike told again).
- **Taibah** was dated 1 Oct; the coalition's own statement dates it to 05:11 on 29 Sep.
- **Ships:** Al-Mihwar's "tanker near Bab al-Mandab" and Seatrade's report the next day were both the UKMTO near miss of 4 Oct (Chrystal Sky).

**Now (`ledger.ts`, `ledger-baseline.ts`):**
- **One row per facility.** Riyadh's Aramco sites are one row, Khurais is the East-West pipeline's pump station, and Rabigh has its own row. A name with no place never makes a row (`placeless`).
- **One strike, one hit.** A site can be hit more than once a day. A second hit that day needs the reader's `again` ("struck again", "a new wave", new sirens) or a time three or more hours from every hit. Unclear means the same strike.
- **The reader returns the strike's own date and time, and `earlier`** for a report about an earlier strike (confirmations, satellite pictures, footage, responses, "still burning").
- **The research rows** carry the corrected table; `wrong` and `wrongShips` keep the retellings out.

Corrected attacks on Saudi energy, 19 Sep to 5 Oct:

| Date | Site | Source | Claim only? |
|---|---|---|---|
| 19 Sep | Riyadh depot | AFP | no |
| 19 Sep | Yanbu | Saree | yes |
| 24 Sep | Yanbu | Saree | yes |
| 29 Sep | Taibah | Coalition | no |
| 30 Sep | Abqaiq | Ali Bk 37488 | yes |
| 1 Oct | Yanbu | Maritime Executive | no |
| 3 Oct | Riyadh | Reuters | no |
| 4 Oct | Khurais pump station | AFP | no |
| 4 Oct | Riyadh | Saree | yes |
| 5 Oct | Rabigh | OilPrice | yes |

### Process lessons

- **Card times in reviews:** the operator's times are Israel time (UTC+3). A review file's local date must roll over at midnight. The 5 Oct review slices had the date one day early after 21:00 UTC.
- **Watch the source groups:** two outlets in the wrong group (Bin Saeed, Shin Persian) caused side mistakes across all three days. A new source gets its group from its own posts, checked, never from its name.
