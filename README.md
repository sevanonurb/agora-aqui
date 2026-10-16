# Agora, aqui — the right card, at the right place and time

An experiment for newcomers in the Netherlands. A small phone page that shows the **3 most
relevant cards** for where you are and what time it is. For example:
*"Amsterdam Zuid: transfer via the stairs, not the gates"*, *"off-peak ends in 6 min"*,
*"rain here in 10 min"*.

**Why it exists.** Almost every problem a newcomer hits already has a published solution:
- Waternet's 500+ free water taps;
- NS's page on stations where passing the gates while transferring costs extra;
- the HogeNood toilet map.

The trouble is that the solution reaches you at the wrong moment, or never. This project does not
create data. It connects *the situation you are in* to *knowledge that already exists*, and explains it.

> Interface language today: **Portuguese**. Card text is data (`cartoes.json`), so other languages are a data change, not a code change.

## The principle — one function

```
relevance(card, situation) = condition(card, situation) · usefulness(card) · validity(card)

condition   ∈ {0,1}  explicit predicates: near a station, time window, profile, rain, an event
usefulness  = α/(α+β), Beta prior set by the source's authority, updated by 👍/👎,
              with exponential forgetting (λ = 0.98/day) so rules that change can recover
validity    = 0 after the card's expiry date (e.g. Amsterdam Zuid's entrance changes on 2026-11-01)
```

- Output: the top 3 cards. Ties go to the card with more matched predicates.
- **Every card says why it appeared** ("you are 40 m from Amsterdam Zuid · it is 15:54").
- No black box.

## Privacy by construction

- Location, time and answers **never leave the phone**. There is no server, account or analytics.
- Weather is requested **directly from the phone** to Buienradar and Open-Meteo. The map uses OpenStreetMap tiles.
- Your 👍/👎 and written comments stay in the browser's `localStorage`. *"Download my answers (.json)"* exports them only when you choose.

## Cards

- Every card carries **a source** and **an expiry date**. **No source, no card.**
- Sources are marked by authority: `oficial`, `medido` (observed in the field), `imprensa`, `comunidade` or `blog`. Lower authority starts with a weaker prior.
- Cards with known doubts say so on screen. For example, the source on the exact end of the evening off-peak window is not an official NS page.

## Run

```bash
python3 -m http.server 8391 --bind 127.0.0.1
# open http://localhost:8391/  — test without GPS: ?lugar=ams-zuid&t=2026-03-12T15:54:00&chuva=10
node teste.mjs                 # 16 checks: real-use scenarios, peak-hour boundaries, Beta, Buienradar parsing
```

On a phone over USB: `adb reverse tcp:8391 tcp:8391`. `localhost` is a secure context, so geolocation works without HTTPS.
After the first visit it works offline (service worker).

## Known limits

- It is a web page, so **it cannot run in the background**. The "you left the station — did you check out?" reminder only works while the page is open.
- The phone cannot know when you tap a physical OV card. Station entry and exit are **inferred from location**.
- The rain map grid is a **model** (Open-Meteo), not radar. The orange line on the chart is Buienradar's radar nowcast for your point.
- Train disruptions need an NS API key, which is not included.
- Tested by one person, in one area of Amsterdam, for a few days. **Demand is not measured.**

## Sources used by the cards

[NS alternative routes](https://www.ns.nl/en/travel/check-in-check-out/alternative-routes) ·
[Waternet tap water](https://www.waternet.nl/en/service-and-contact/tap-water/can-you-drink-tap-water-in-amsterdam/) ·
[Buienradar](https://www.buienradar.nl) · [Open-Meteo](https://open-meteo.com) ·
[OpenStreetMap](https://www.openstreetmap.org/copyright) · others are listed in each card.

## License

[EUPL-1.2](LICENSE), the licence most used in the Dutch government's open-source register.
