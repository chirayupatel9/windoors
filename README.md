# WinDoors — Aluminium Window & Door Quotation Studio

Draw an aluminium window or door to size, choose the profile series, glazing and
hardware, and print a priced quotation with a proper elevation drawing for every
line — the way a fabricator's quote actually looks.

**Live: https://chirayupatel9.github.io/windoors/**

Everything runs in the browser. There is no server, no sign-in and no upload:
your rates, your customers and your jobs stay in your own browser
(`localStorage`), and a job can be saved to a `.json` file and reopened later or
on another machine.

## What it does

**Draw to size.** Enter width and height in mm and the elevation is generated
from real profile geometry — outer frame, mullions, transoms, sash faces and the
sliding interlock all come from the series you picked, not from a fixed picture.
The drawing carries what a shop drawing carries:

- dimension chains for the overall size and for every module, to the centre-line
  of the divider, rounded to whole millimetres
- opening symbols to ISO 11091 — the dashed apex sits on the hinge side, with
  side-hung, top-hung, bottom-hung, tilt & turn and door leaves each drawn
  correctly, plus slide-direction arrows for sliding sashes
- glass panes numbered in reading order, so the glazing spec reads
  `(1,2,3) 6 MM REFLECTIVE TOUGHENED GLASS` exactly like the printed quote
- member tags — `F1` fixed, `S1` sash, `MS1` mesh, `L1` louver, `M1` mullion,
  `T1` transom
- mesh hatching, louver slats and exhaust-fan cut-outs
- a plan section under sliding items showing the tracks, `OUT` and `IN`

**Build any configuration.** An item is a stack of rows; each row is either a run
of fixed/openable panels split by mullions, or a sliding track with 1–6 sashes and
an optional mosquito-net sash. Row heights and panel widths always re-fit to the
overall size, so the drawing can never disagree with the dimensions. 26 presets
cover the usual fixed, sliding, casement, ventilator and door arrangements.

**Price it.** Per item: aluminium and fabrication at the series rate per sq.ft
(with a minimum billed area), powder-coat extra, glass per pane, mesh per pane,
and hardware picked automatically from each leaf's opening type. Then wastage,
per-line add-ons and discount, or a manual unit-price override. On the quotation:
overall discount, installation, transportation, loading & unloading, another
named charge, GST and round-off.

**Print it.** The Quotation tab is a real A4 document, paginated by measuring
rendered row heights so a tall drawing never gets sliced across a page break.
Print (or Ctrl/Cmd-P) goes through the browser to paper or PDF.

**Get it out.** Single drawing as PNG or SVG, all drawings as one PNG contact
sheet, the priced lines as CSV, and the whole job as a `.json` file.

## Making it yours

Open **Library** and edit in place — nothing is hard-coded:

| Table | What it drives |
| --- | --- |
| Profile series | Frame, sash, mullion, transom and interlock face widths (the drawing) plus rate per sq.ft, minimum area and wastage (the price) |
| Glazing | Glass names and rate per sq.ft |
| Mesh | Mesh types and rate per sq.ft |
| Profile colours | Name, brand, extra per sq.ft, and the swatch the drawing paints aluminium with |
| Hardware | Charged per leaf, per window or per sq.ft |

Open **Setup** for your company details and logo, bank details, quote number,
customer, charges and the terms & conditions text.

> The bank details you enter live only in your browser and in job files you save
> yourself — they are not in this repository.

## Keyboard

| Key | Action |
| --- | --- |
| `1` `2` `3` `4` | Items / Quotation / Setup / Library |
| `N` | Add an item |
| `Ctrl`/`Cmd` `P` | Print the quotation |
| `Ctrl`/`Cmd` `S` | Save the job file |

## Running it locally

It is plain ES modules and CSS with no build step, but the browser needs it over
HTTP rather than `file://` for module imports:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

To get one self-contained HTML file you can email or run off a USB stick:

```sh
npm install --no-save esbuild
node tools/build-single.mjs   # -> dist/index.html
```

## How it is put together

```
index.html
assets/css/app.css        application chrome
assets/css/print.css      the A4 quotation sheet, screen and paper
assets/js/
  geometry.js             mm layout solver: members, panes, dimension chains
  draw.js                 SVG elevation renderer and plan section
  pricing.js              per-item cost build-up and quotation totals
  catalog.js              built-in series, glass, mesh, colour, hardware
  presets.js              26 ready-made configurations
  store.js                state, localStorage, JSON import/export
  editor.js  quote.js  settings.js  ui.js  exporters.js  app.js
tools/build-single.mjs    optional single-file bundle
```

`geometry.js` is the piece worth reading: it takes an item and returns real
millimetre geometry, and every other part — the drawing, the areas, the glazing
groups and the price — is derived from that one solve, so they cannot drift
apart.

## Deployment

`.github/workflows/pages.yml` publishes the repository to GitHub Pages on every
push. If Pages has not been switched on yet, do it once in
**Settings → Pages → Build and deployment → Source: GitHub Actions**.
