/*
 * Default libraries. Everything here is user-editable in the app (Library tab)
 * and is stored per-browser, so a fabricator can dial in their own rates.
 *
 * Profile geometry fields drive the drawing; rate fields drive the price.
 *   face      - visible face width of the outer frame, mm
 *   sash      - visible face width of an openable sash, mm
 *   mullion   - vertical divider face width, mm
 *   transom   - horizontal divider face width, mm
 *   interlock - overlap between two sliding sashes, mm (sets the panel dim chain)
 *   bead      - glazing bead reveal, mm
 */

export const FAMILIES = {
  casement: 'Casement / openable',
  sliding: 'Sliding',
  fix: 'Fixed glazing',
  ventilator: 'Ventilator',
};


/*
 * Profile sections — the extrusions themselves. A fabricator buys aluminium
 * by weight, so each section carries kg/m and a rate per kg; the cut lengths
 * come from the drawing, which means a quote can be costed on real metal
 * instead of a flat rate per square foot.
 */
export const PROFILE_ROLES = {
  frame: 'Outer frame',
  sash: 'Sash / shutter',
  mullion: 'Mullion (vertical)',
  transom: 'Transom (horizontal)',
  bead: 'Glazing bead',
  interlock: 'Sliding interlock',
  meshSash: 'Mesh sash',
  louver: 'Louver blade',
  other: 'Other / accessory',
};

/** Roles whose face width, when a section is assigned, drives the drawing. */
export const FACE_ROLES = {
  face: 'frame', sash: 'sash', mullion: 'mullion',
  transom: 'transom', bead: 'bead', interlock: 'interlock',
};

export const defaultProfiles = () => [
  // 40mm casement
  { id: 'pr_c40_of', code: 'WC40-OF', name: 'Casement 40mm outer frame', role: 'frame', face: 40, kgPerM: 0.985, ratePerKg: 348, barLength: 4877 },
  { id: 'pr_c40_sh', code: 'WC40-SH', name: 'Casement 40mm shutter', role: 'sash', face: 40, kgPerM: 0.921, ratePerKg: 348, barLength: 4877 },
  { id: 'pr_c40_mu', code: 'WC40-MU', name: 'Casement 40mm mullion', role: 'mullion', face: 40, kgPerM: 1.184, ratePerKg: 348, barLength: 4877 },
  { id: 'pr_c40_tr', code: 'WC40-TR', name: 'Casement 40mm transom', role: 'transom', face: 40, kgPerM: 1.184, ratePerKg: 348, barLength: 4877 },
  { id: 'pr_c40_bd', code: 'WC40-BD', name: 'Casement 40mm glazing bead', role: 'bead', face: 6, kgPerM: 0.212, ratePerKg: 352, barLength: 4877 },

  // Vega slim sliding
  { id: 'pr_vs_of', code: 'VS-OF', name: 'Vega slim sliding frame', role: 'frame', face: 18, kgPerM: 0.762, ratePerKg: 352, barLength: 5850 },
  { id: 'pr_vs_sh', code: 'VS-SH', name: 'Vega slim sliding shutter', role: 'sash', face: 32, kgPerM: 0.648, ratePerKg: 352, barLength: 5850 },
  { id: 'pr_vs_il', code: 'VS-IL', name: 'Vega slim interlock', role: 'interlock', face: 18, kgPerM: 0.455, ratePerKg: 352, barLength: 5850 },
  { id: 'pr_vs_ms', code: 'VS-MS', name: 'Vega slim mesh sash', role: 'meshSash', face: 24, kgPerM: 0.386, ratePerKg: 352, barLength: 5850 },
  { id: 'pr_vs_bd', code: 'VS-BD', name: 'Vega slim glazing bead', role: 'bead', face: 5, kgPerM: 0.168, ratePerKg: 352, barLength: 5850 },

  // Silenza hidden slim sliding
  { id: 'pr_sz_of', code: 'SZ-OF', name: 'Silenza hidden frame', role: 'frame', face: 20, kgPerM: 0.884, ratePerKg: 366, barLength: 5850 },
  { id: 'pr_sz_sh', code: 'SZ-SH', name: 'Silenza hidden shutter', role: 'sash', face: 26, kgPerM: 0.712, ratePerKg: 366, barLength: 5850 },
  { id: 'pr_sz_il', code: 'SZ-IL', name: 'Silenza interlock', role: 'interlock', face: 16, kgPerM: 0.402, ratePerKg: 366, barLength: 5850 },

  // Generic
  { id: 'pr_lv_bl', code: 'GEN-LV', name: 'Louver blade', role: 'louver', face: 0, kgPerM: 0.246, ratePerKg: 344, barLength: 4877 },
  { id: 'pr_fx50_of', code: 'FX50-OF', name: 'Fix glazing 50mm frame', role: 'frame', face: 50, kgPerM: 1.312, ratePerKg: 344, barLength: 5850 },
  { id: 'pr_fx50_mu', code: 'FX50-MU', name: 'Fix glazing 50mm mullion', role: 'mullion', face: 50, kgPerM: 1.564, ratePerKg: 344, barLength: 5850 },
];

export const defaultSeries = () => [
  {
    id: 'ser_cas40', name: '40MM CASEMENT SERIES', family: 'casement',
    face: 40, sash: 40, mullion: 40, transom: 40, interlock: 0, bead: 6,
    rate: 640, minSqft: 10, wastagePct: 0,
    note: '40mm casement system — fixed, openable, top-hung and ventilator combinations.',
    costing: 'sqft', labourPerSqft: 210,
    sections: { frame: 'pr_c40_of', sash: 'pr_c40_sh', mullion: 'pr_c40_mu', transom: 'pr_c40_tr', bead: 'pr_c40_bd' },
  },
  {
    id: 'ser_vegaslim', name: 'SLIM SLIDING SERIES', family: 'sliding',
    face: 18, sash: 32, mullion: 40, transom: 40, interlock: 18, bead: 5,
    rate: 590, minSqft: 10, wastagePct: 0, tracks: [2, 3, 4],
    note: 'Slim-line sliding with narrow interlock — 2, 3 and 4 track.',
    costing: 'sqft', labourPerSqft: 195,
    sections: { frame: 'pr_vs_of', sash: 'pr_vs_sh', interlock: 'pr_vs_il', meshSash: 'pr_vs_ms', bead: 'pr_vs_bd' },
  },
  {
    id: 'ser_silenza', name: 'HIDDEN SLIM SLIDING SERIES', family: 'sliding',
    face: 20, sash: 26, mullion: 40, transom: 40, interlock: 16, bead: 5,
    rate: 780, minSqft: 10, wastagePct: 0, tracks: [2, 3, 4],
    note: 'Hidden-sash slim sliding — minimum sightline.',
    costing: 'sqft', labourPerSqft: 240,
    sections: { frame: 'pr_sz_of', sash: 'pr_sz_sh', interlock: 'pr_sz_il', bead: 'pr_vs_bd' },
  },
  {
    id: 'ser_slide27', name: 'STANDARD 2 TRACK SLIDING (27MM)', family: 'sliding',
    face: 27, sash: 40, mullion: 40, transom: 40, interlock: 26, bead: 5,
    rate: 385, minSqft: 10, wastagePct: 0, tracks: [2, 3],
    note: 'Economy domal-type sliding window.',
    costing: 'sqft', labourPerSqft: 150,
    sections: { frame: 'pr_vs_of', sash: 'pr_vs_sh', interlock: 'pr_vs_il', bead: 'pr_vs_bd' },
  },
  {
    id: 'ser_fix50', name: 'STRUCTURAL FIX GLAZING 50MM', family: 'fix',
    face: 50, sash: 0, mullion: 50, transom: 50, interlock: 0, bead: 8,
    rate: 520, minSqft: 12, wastagePct: 0,
    note: 'Heavy fixed glazing for tall spans and staircase lights.',
    costing: 'sqft', labourPerSqft: 165,
    sections: { frame: 'pr_fx50_of', mullion: 'pr_fx50_mu', transom: 'pr_fx50_mu', bead: 'pr_c40_bd' },
  },
  {
    id: 'ser_vent', name: 'VENTILATOR SERIES 40MM', family: 'ventilator',
    face: 40, sash: 38, mullion: 38, transom: 38, interlock: 0, bead: 6,
    rate: 610, minSqft: 6, wastagePct: 0,
    note: 'Louver + exhaust fan cut-out ventilators for toilets and utilities.',
    costing: 'sqft', labourPerSqft: 220,
    sections: { frame: 'pr_c40_of', sash: 'pr_c40_sh', mullion: 'pr_c40_mu', transom: 'pr_c40_tr', bead: 'pr_c40_bd', louver: 'pr_lv_bl' },
  },
];

export const defaultGlass = () => [
  { id: 'gl_c5t', name: '5 MM CLEAR TOUGHENED GLASS', rate: 95 },
  { id: 'gl_r5t', name: '5 MM REFLECTIVE TOUGHENED GLASS', rate: 132 },
  { id: 'gl_f5t', name: '5 MM FROSTED TOUGHENED GLASS', rate: 126 },
  { id: 'gl_r6t', name: '6 MM REFLECTIVE TOUGHENED GLASS', rate: 158 },
  { id: 'gl_c6t', name: '6 MM CLEAR TOUGHENED GLASS', rate: 118 },
  { id: 'gl_lam', name: '(5+1.52+5) CLEAR 11.52MM LAM', rate: 318 },
  { id: 'gl_lamr', name: '(5+1.52+5) REFLECTIVE 11.52MM LAM', rate: 352 },
  { id: 'gl_c8t', name: '8 MM CLEAR TOUGHENED GLASS', rate: 205 },
  { id: 'gl_dgu', name: 'DGU 24MM (5+14AIR+5) TOUGHENED', rate: 430 },
];

export const defaultMesh = () => [
  { id: 'msh_fiber', name: 'Fiber mesh', rate: 48 },
  { id: 'msh_ss', name: 'SS-304 mesh', rate: 185 },
  { id: 'msh_alu', name: 'Aluminium mesh', rate: 95 },
];

export const defaultColours = () => [
  { id: 'col_white', name: 'WHITE', brand: 'AkzoNobel', extra: 0, swatch: '#e9eaec' },
  { id: 'col_grey', name: 'GREY', brand: 'AkzoNobel', extra: 0, swatch: '#8d9199' },
  { id: 'col_black', name: 'BLACK', brand: 'AkzoNobel', extra: 12, swatch: '#3a3d42' },
  { id: 'col_ivory', name: 'IVORY', brand: 'AkzoNobel', extra: 0, swatch: '#ddd6c4' },
  { id: 'col_brown', name: 'BROWN', brand: 'AkzoNobel', extra: 6, swatch: '#6b5545' },
  { id: 'col_wood', name: 'WOOD FINISH', brand: 'AkzoNobel', extra: 58, swatch: '#9a6b3f' },
  { id: 'col_anod', name: 'NATURAL ANODISED', brand: 'Anodising', extra: 26, swatch: '#b8bcc0' },
];

/* Per-sash / per-item hardware. `per` = 'sash' | 'item' | 'sqft' */
export const defaultHardware = () => [
  { id: 'hw_cas_std', name: 'Casement friction hinge + handle', per: 'sash', rate: 1180 },
  { id: 'hw_cas_mp', name: 'Casement multi-point lock set', per: 'sash', rate: 1950 },
  { id: 'hw_sld_touch', name: 'Sliding touch lock', per: 'sash', rate: 420 },
  { id: 'hw_sld_mp', name: 'Sliding multi-point lock', per: 'sash', rate: 1860 },
  { id: 'hw_mesh_handle', name: 'Mesh touch-lock handle', per: 'sash', rate: 260 },
  { id: 'hw_door_lock', name: 'Door mortise lock + cylinder', per: 'sash', rate: 3450 },
  { id: 'hw_fan_ring', name: 'Exhaust fan cut-out ring', per: 'sash', rate: 340 },
  { id: 'hw_louver', name: 'Louver blade set', per: 'sqft', rate: 165 },
  { id: 'hw_premium', name: 'Premium hardware upgrade (HIVIK)', per: 'item', rate: 0 },
];

/*
 * Defaults a new quotation starts from. These are rates, not amounts — the
 * quotation keeps its own copy once created, so changing a default here never
 * silently reprices a quote you have already sent.
 *
 * Site labour is separate from the fabrication labour on a series: that one is
 * inside the item price when a series is costed by weight, this one is charged
 * across the whole job.
 */
export const defaultChargeRates = () => ({
  labourPerSqft: 45,
  labourLabel: 'Labour charges',
  transport: 0,
  loading: 0,
  installation: 0,
  otherLabel: 'Other charges',
  gstPct: 18,
  gstLabel: 'GST',
  discountPct: 0,
});

export const HANDLE_COLOURS = ['BLACK', 'SILVER', 'WHITE', 'CHAMPAGNE', 'ROSE GOLD'];
export const LOCKING = ['Multi-point', 'Touch lock', 'Single point', 'Mortise lock', '—'];

/*
 * Cell functions. `glazed` cells get a glass number in the drawing and are
 * charged glass; `sashCount` marks a cell as an opening leaf for hardware.
 */
export const CELL_FN = {
  fix:            { label: 'Fixed glass',        short: 'F',   glazed: true,  sash: false },
  'casement-l':   { label: 'Openable — hinge L', short: 'S',   glazed: true,  sash: true  },
  'casement-r':   { label: 'Openable — hinge R', short: 'S',   glazed: true,  sash: true  },
  'top-hung':     { label: 'Top hung / awning',  short: 'S',   glazed: true,  sash: true  },
  'bottom-hung':  { label: 'Bottom hung / hopper', short: 'S', glazed: true,  sash: true  },
  'tilt-turn-l':  { label: 'Tilt & turn — L',    short: 'S',   glazed: true,  sash: true  },
  'tilt-turn-r':  { label: 'Tilt & turn — R',    short: 'S',   glazed: true,  sash: true  },
  'door-l':       { label: 'Door leaf — hinge L', short: 'D',  glazed: true,  sash: true  },
  'door-r':       { label: 'Door leaf — hinge R', short: 'D',  glazed: true,  sash: true  },
  louver:         { label: 'Louver / jali',      short: 'L',   glazed: false, sash: true  },
  mesh:           { label: 'Mesh panel',         short: 'MS',  glazed: false, sash: true  },
  fan:            { label: 'Exhaust fan cut-out', short: 'FAN', glazed: false, sash: true },
  grill:          { label: 'Grill / safety bars', short: 'G',  glazed: true,  sash: false },
  panel:          { label: 'Solid / ACP panel',  short: 'P',   glazed: false, sash: false },
};

export const SLIDING_FN = {
  'slide-l':  { label: 'Sliding sash ← (opens left)',  short: 'S', glazed: true,  sash: true },
  'slide-r':  { label: 'Sliding sash → (opens right)', short: 'S', glazed: true,  sash: true },
  'slide-fix':{ label: 'Fixed sash in track',          short: 'F', glazed: true,  sash: false },
  'slide-mesh': { label: 'Mesh sash',                  short: 'MS', glazed: false, sash: true },
};

export const ALL_FN = { ...CELL_FN, ...SLIDING_FN };

export const isGlazed = (fn) => !!ALL_FN[fn]?.glazed;
export const isSash = (fn) => !!ALL_FN[fn]?.sash;

export const defaultTerms = () => [
  {
    heading: 'Terms and Conditions:-',
    lines: [
      '1. Payment terms — payment structure based on order value:',
      '     For quotations below ₹1.5 lakh: 100% advance at the time of order confirmation.',
      '     For quotations between ₹1.5 lakh and ₹50 lakh: 50% advance at order confirmation, 40% at material delivery, 10% after installation.',
      '     For quotations above ₹50 lakh: 25% advance at order confirmation, 55% at material delivery, 20% after installation.',
      '2. Validity of quote 30 days; total execution of project should be completed latest by 3 months.',
      '3. P.O. & payments should be made in the name of the company stated above.',
      '4. The prices are based on the sizes provided by the customer. Prices are valid for a variation in sizes up to +/- 30mm per window provided the design and style of the product remains unchanged. The customer will be charged on a pro-rata basis for the difference between the actual and given sizes beyond the above variation.',
      '5. After handing over the windows, cleaning is not in our scope.',
      '6. Window security tape should not be removed while installing windows. After installation, security tape will be removed by us and is chargeable at ₹100 per window.',
      '7. If any other commitment is given by our sales team, please call us before placing the order.',
      '8. After handover, any service required related to windows & doors is chargeable at ₹350 per visit.',
      '9. Material unloading & storage is in the customer scope.',
      '10. All disputes shall be subject to local jurisdiction only.',
    ],
  },
  {
    heading: 'Pre-requisites for installation of windows:-',
    lines: [
      '1. Walls should be plastered from inside and outside, with inside POP complete.',
      '2. All jambs, sills and soffits should be plastered.',
      '3. Flooring (where doors have to be installed) should be complete.',
      '4. Aperture should be smooth.',
      '5. Base and top of window should be water levelled and sides should be in vertical plumb.',
      '6. Sill width should be more than the window width.',
      '7. Opening should be accessible from inside for installation.',
      '8. Grills: adequate care should be taken if grills have to be installed. (a) For horizontal slider windows the grill should be provided on the outer face before installation of the window. (b) For casement windows a screw-type grill is recommended after installation.',
      '9. Installation should happen before the last coat of paint. At least one coat of paint should be done before installation begins.',
      '10. Scaffolding / bracing should not interrupt the openings where windows are supposed to be installed.',
    ],
  },
];
