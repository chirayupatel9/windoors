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

**Size it on the drawing.** Every dimension on the sheet is live. Click one and
type an exact millimetre value, or drag a mullion, a transom or the frame edge
to size it by eye. Changing a module keeps the overall size and takes the
difference from its neighbour, the way moving a divider behaves on a drawing
board; changing an overall dimension rescales what is inside it. Sliding sash
widths follow from the track count and interlock, so they are dimensioned but
not editable — you change the overall width instead.

**Build any configuration.** An item is a stack of rows; each row is either a run
of fixed/openable panels split by mullions, or a sliding track with 1–6 sashes and
an optional mosquito-net sash. Row heights and panel widths always re-fit to the
overall size, so the drawing can never disagree with the dimensions. 26 presets
cover the usual fixed, sliding, casement, ventilator and door arrangements.

**Price it, two ways.** Each series is costed either at a **flat rate per
sq.ft** — fast, for a series you quote every day — or **by weight of metal**:
the cut lengths from the drawing x kg/m x rate/kg, plus fabrication labour per
sq.ft. Weight costing also tells you the kilos and the number of bars to order.
On top of either: powder-coat extra, glass per pane, mesh per pane, hardware
picked automatically from each leaf's opening type, then wastage, per-line
add-ons and discount, or a manual unit-price override. On the quotation:
overall discount, installation, transportation, loading & unloading, another
named charge, GST and round-off.

**Print it.** The Quotation tab is a real A4 document, paginated by measuring
rendered row heights so a tall drawing never gets sliced across a page break.
Print (or Ctrl/Cmd-P) goes through the browser to paper or PDF.

**Get it out.** Single drawing as PNG or SVG, all drawings as one PNG contact
sheet, the priced lines as CSV, the whole job as a `.json` file, and a **cutting
list** CSV for the factory — every cut length by mark, plus metres, kilos and
bars to order per profile. The cutting list is shop paperwork and never appears
on the customer's quotation.

## Masters

Open **Masters** and edit in place — nothing is hard-coded:

| Table | What it drives |
| --- | --- |
| Profile sections | One row per extrusion you buy: code, description, role, face width, kg/m, rate/kg, standard bar length |
| Profile series | What you pick on an item. Assign sections to its roles, then cost it by flat rate per sq.ft or by weight |
| Glazing | Glass names and rate per sq.ft |
| Mesh | Mesh types and rate per sq.ft |
| Profile colours | Name, brand, extra per sq.ft, and the swatch the drawing paints aluminium with |
| Hardware | Charged per leaf, per window or per sq.ft |

Assigning a section to a series does two things at once: its **face width takes
over the drawing** for that member (the field shows where it came from and stops
being editable), and its **kg/m and rate/kg cost it** when the series is on
weight costing. So the master table drives the picture and the price from one
place, and they cannot disagree.

### Locking the masters

Set a passcode in Masters and the tables render read-only until it is entered.
It stays unlocked in that browser until you lock it again, and quotation items
stay fully editable throughout — only rates and profiles are protected.

> This stops a rate being changed by accident. It is **not** encryption: the
> data lives in the browser and someone determined can still read it. The
> passcode is stored as a one-way hash, so if it is forgotten, clear the site
> data and set a new one — job files you have saved are unaffected.

Open **Setup** for your company details and logo, bank details, quote number,
customer, charges and the terms & conditions text.

> The bank details you enter live only in your browser and in job files you save
> yourself — they are not in this repository.

## Keyboard

The charges that get settled last — labour, cartage, the discount agreed on the
phone, GST — sit on the Quotation tab itself, so they can be adjusted while
watching the total rather than in a separate screen. On a phone the A4 sheet
scales to the screen width, the way a print preview does; what prints is
unaffected.

Light and dark both ship. The theme button in the top bar cycles
**follows your device → light → dark**, and the choice is remembered per
browser. The drawing sheet stays paper-white in both, because that is what
prints.

| Key | Action |
| --- | --- |
| `1` `2` `3` `4` | Items / Quotation / Setup / Masters |
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
assets/css/fonts.css      self-hosted Space Grotesk / IBM Plex faces
assets/css/app.css        application chrome, light and dark
assets/css/print.css      the A4 quotation sheet, screen and paper
assets/js/
  geometry.js             mm layout solver: members, panes, dimension chains,
                          cut lengths, metal weight, and the rules for
                          editing a dimension
  icons.js                inline SVG icon set
  draw.js                 SVG elevation renderer and plan section
  pricing.js              per-item cost build-up and quotation totals
  catalog.js              built-in profile sections, series, glass, mesh,
                          colour, hardware
  presets.js              26 ready-made configurations
  store.js                state, localStorage, JSON import/export
  editor.js  quote.js  settings.js (masters)  ui.js  exporters.js  app.js
tools/build-single.mjs    optional single-file bundle
```

`geometry.js` is the piece worth reading: it takes an item and returns real
millimetre geometry, and every other part — the drawing, the areas, the glazing
groups and the price — is derived from that one solve, so they cannot drift
apart.

## Deployment

GitHub Pages has to be switched on once by hand — the Actions token is not
allowed to create the site itself. In **Settings → Pages → Build and
deployment**, either source works because the app is plain static files:

- **Deploy from a branch** → `claude/aluminum-quotation-generator-me6bju`,
  folder `/ (root)`. Live about a minute after you save; nothing else to do.
- **GitHub Actions** → then re-run the *Deploy to GitHub Pages* workflow.
  `.github/workflows/pages.yml` publishes on every push after that.

The workflow is written so that it stays green and simply does nothing while
Pages is off or set to branch mode.
