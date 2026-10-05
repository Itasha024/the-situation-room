# Review brief: Yemen Conflict Desk cards

The desk (https://thesituationroom.live/yemen-conflict-desk) publishes short news cards about the Saudi/Yemeni-government vs Houthi war (started summer 2026), Red Sea shipping, and Houthi strikes on Saudi energy. Each card has: source (the outlet that leads it), summary (headline), text (body), url (the post/article), also (other outlets folded in as "Also reported by"), citing (an outlet the card relays).

Times: `idt` is Israel time (UTC+3), which the operator uses.

Source groups (the desk's alignment of outlets) are in `groups.txt` next to this file. Iranian state outlets (Press TV, IRNA, Fars, Mehr, SNN, Nour News, IRIB) count as Houthi-aligned. Houthi-aligned outlets and spokesmen call Houthi forces "Yemeni forces", "the Yemeni armed forces" or "the Yemeni army", and call the government side "Saudi mercenaries" or "pro-Saudi forces".

## What the operator flagged on 3 Oct (the standard to hold every card to)

- 11:20: should have gone to the original source.
- 11:11: should have gone to the original @axistaiz (Taiz military axis) post.
- 11:01: useless report, shouldn't have got in (a routine currency-rate list).
- 10:58: should have gone to the minister of human rights' own post (https://x.com/mashdal).
- 10:53 (×2): should have gone to Axios; and the UK minister's own post (https://x.com/SDoughtyMP).
- 10:52: should have gone to Axios.
- 10:35: should have written "Yemeni military official: …" (a quote from an unnamed official, given as an attributed quote).
- 10:08: no need for a full video transcript, just the main things.
- 10:07: should have gone to Saudi Civil Defence's own post.
- 09:55 + 10:00: same event, no new development (two cards).
- 09:45: not relevant (a low-level media-office appointment).
- 09:29: missing context from the report on why it's relevant.
- 09:16: don't bring "summary of events" posts from Iranian channels.
- 07:47: don't bring numbers from Iranian channels when they clearly take them from official Yemeni sources the desk already reads.
- 07:09: Axios was in "Also"; it should have led, as the original. When the card comes from the original source, "Also" isn't needed.
- 06:09: the Pakistan report was real but its link had no connection to it. In the Trump report: should have gone to Axios. You miss details when you don't take these reports from the original; read the full article and write a body with everything relevant.
- 05:56: the card came from Axios, but probably only from the headline; the whole article had more relevant information.
- 13:33: a summary-like post of attacks already reported one by one in real time. No need.
- 13:00–14:00: the reports about Saudi attacks on Sanaa were basically the same event; there was no need for a hundred reports.
- 14:16: a Houthi-aligned source calling Houthi forces "Yemeni forces"; the desk wrote "Yemeni government forces". Big mistake.

**Operator clarifications (5 Oct). Do NOT flag these as mistakes:**
- A side's count over a period, of what it launched or struck or of what the other side did ("60 Saudi air strikes in 24 hours", "324 targets"), is wanted.
- Rates, appointments and the like are NOT banned as categories. Flag only when this particular card says nothing new or relevant about the war or its effects.
- A video can make a long card if what was said is interesting. The mistake is transcribing a clip at random instead of writing the news in it.
- The same Saudi facility CAN be hit more than once a day. Two cards about two separate strikes are right.

## Your job

Read EVERY card in your slice file. For each card that has a mistake, fetch the source post or article (curl or WebFetch; Telegram posts read at https://t.me/s/<channel>/<id>; X posts via https://api.fxtwitter.com/<user>/status/<id>) whenever you need to, to judge it. Typical cases: the side of the forces, whether the outlet relays another outlet, or whether the link matches the card. Be efficient: fetch only where the judgement needs it.

Classes (use these exact slugs, or `other:<short-name>` for something new):
- `duplicate`: the same event as an earlier card (in this slice or the previous cards you can see) with no new fact.
- `recap`: retells several events already reported one by one.
- `iran-relay`: an Iranian channel relaying a Yemeni official's words or numbers that the desk reads first-hand.
- `wrong-side`: forces assigned to the wrong side (the "Yemeni forces" trap in either direction), or a side's claim told as fact.
- `attribution`: who said it is wrong or missing (should be "Yemeni military official: …", a named spokesman, etc.).
- `not-original`: a relay where the original (outlet or official account) should have led; name the original if you can find it.
- `also-wrong`: "Also" lists outlets that don't belong, or lists the original.
- `headline-only`: from a major outlet's article, but the card has clearly only the headline or lede; the article has more.
- `wrong-link`: the url doesn't carry the card's story.
- `transcript`: a transcript dump instead of news.
- `no-context`: needs a clause of context to make sense.
- `irrelevant`: nothing new or relevant about the war or its effects.
- `out-of-scope`: not this war.
- `factual`: the headline or body says something the source doesn't (wrong place, figure, actor).
- `false-report`: shown false later (old footage, denied by both, etc.).

Precision matters more than volume. Flag only real mistakes you are confident about. Don't flag style preferences.

## Output

Write `findings-<N>.md` next to this file, where N is your slice number:

```
| idt | fp | source | class | what was wrong | the right version / original | rule that should catch it |
```

After the table, add a short section **Patterns**: 3–8 bullet points on recurring mistakes in your slice, with counts. Also list any outlet that seems to be in the wrong alignment group.

Return a 5-line summary as your final message: counts per class and the top 3 patterns.
