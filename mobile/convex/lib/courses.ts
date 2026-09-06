/**
 * Static golf course library.
 * Each course has 18 holes with:
 *   - par, stroke index (difficulty rank), and yardages per tee box
 *   - green data: dominant break direction + severity (feet of break per 10 ft of putt) + slope description
 *
 * Courses are representative scorecards. Yardages are approximate.
 */

export type TeeBox = "championship" | "regular" | "forward";

export type BreakDirection =
  | "left_to_right"
  | "right_to_left"
  | "uphill"
  | "downhill"
  | "severe_left"
  | "severe_right"
  | "double_break"
  | "relatively_flat";

export interface GreenData {
  breakDirection: BreakDirection;
  /** Approximate break in inches per 10 ft of putt — 0 = flat, 6+ = severe */
  breakSeverityInches: number;
  /** Short description of the slope for the caddie to read */
  slopeNote: string;
  /** Which part of the green is typically fastest / most dangerous */
  dangerZone: "left" | "right" | "front" | "back" | "false_front" | "any" | "none";
}

export interface CourseHole {
  hole: number;
  par: 3 | 4 | 5;
  strokeIndex: number;     // 1-18, 1 = hardest
  yards: Record<TeeBox, number>;
  green: GreenData;
}

export interface GolfCourse {
  id: string;
  name: string;
  location: string;
  /** Feet above sea level — used for altitude yardage correction */
  altitudeFt: number;
  /** Geographic coordinates for live weather lookup */
  lat: number;
  lon: number;
  rating: Record<TeeBox, number>;   // course rating (stroke play)
  slope: Record<TeeBox, number>;    // slope rating (113 = standard)
  holes: CourseHole[];
}

// ─── Helper: build a simple course quickly ───────────────────────────────────

type HoleInput = [
  par: 3 | 4 | 5,
  si: number,
  champ: number,
  regular: number,
  forward: number,
  breakDir: BreakDirection,
  breakSev: number,
  slopeNote: string,
  danger: GreenData["dangerZone"]
];

function buildHoles(data: HoleInput[]): CourseHole[] {
  return data.map((d, i) => ({
    hole: i + 1,
    par: d[0],
    strokeIndex: d[1],
    yards: { championship: d[2], regular: d[3], forward: d[4] },
    green: { breakDirection: d[5], breakSeverityInches: d[6], slopeNote: d[7], dangerZone: d[8] },
  }));
}

// ─── Course data ──────────────────────────────────────────────────────────────

export const COURSE_LIBRARY: GolfCourse[] = [
  // ── 1. Augusta National (approx replica)
  {
    id: "augusta-national",
    name: "Augusta National Golf Club",
    location: "Augusta, GA",
    altitudeFt: 375,
    lat: 33.5021, lon: -82.0194,
    rating: { championship: 76.2, regular: 74.0, forward: 71.5 },
    slope: { championship: 137, regular: 131, forward: 124 },
    holes: buildHoles([
      [4,  4, 445, 420, 390, "right_to_left",  3, "Tier below the ridge slopes hard right-to-left. Approach from right center.", "left"],
      [5,  2, 575, 550, 510, "left_to_right",  2, "Back green drains right. Pin back-right is treacherous.", "right"],
      [4, 16, 350, 335, 310, "downhill",        1, "Downhill green, front bunker eats up short approaches.", "front"],
      [3, 10, 240, 220, 180, "right_to_left",  4, "Slick right-to-left tilt. Two-tier. Miss below the hole always.", "right"],
      [4,  8, 495, 470, 435, "left_to_right",  3, "Uphill approach then falls left on putting surface. Pin right is danger.", "right"],
      [3, 14, 180, 165, 140, "right_to_left",  5, "Famous Rae's Creek guardians. Green falls steeply right-to-left. Short side bunker is death.", "left"],
      [4,  6, 450, 430, 395, "left_to_right",  3, "Elevated green tilts front-to-back. Short is always below hole.", "back"],
      [5, 18, 570, 550, 510, "downhill",        2, "Back portion is the flattest. Front third runs off quickly.", "front"],
      [4, 12, 460, 440, 415, "uphill",          2, "Uphill approach. Green more forgiving than reputation suggests.", "none"],
      [4,  3, 495, 470, 440, "right_to_left",  4, "Two tiers. Bottom tier feeds all the way left. Pin above tier is pinch-worthy.", "left"],
      [4,  5, 520, 505, 470, "left_to_right",  3, "Green surrounded left by trees. Gentle left-to-right slope.", "left"],
      [3, 17, 155, 140, 120, "relatively_flat", 1, "One of Augusta's flatter greens. Relatively benign but edges fall off.", "none"],
      [5,  1, 510, 490, 455, "right_to_left",  3, "Classic back-nine par 5. Approaches from right center easier.", "left"],
      [4,  7, 440, 420, 390, "left_to_right",  4, "Bunker on left. Green slopes left-to-right and is narrow. Pin right is punishing.", "right"],
      [5, 11, 550, 530, 495, "double_break",   5, "Two-tier. Top tier runs back. Bottom tier runs left. Famous back-nine run starts.", "any"],
      [3,  9, 170, 155, 130, "right_to_left",  3, "Reachable par 3. Green tilts right-to-left. Ball releases hard from right half.", "left"],
      [4, 15, 440, 425, 395, "downhill",        3, "Downhill run to green. Front pin = short is dead. Back left is birdie zone.", "front"],
      [4, 13, 465, 445, 415, "right_to_left",  2, "Final approach plays uphill. Green breaks back toward fairway.", "front"],
    ]),
  },

  // ── 2. Pebble Beach Golf Links
  {
    id: "pebble-beach",
    name: "Pebble Beach Golf Links",
    location: "Pebble Beach, CA",
    altitudeFt: 50,
    lat: 36.5681, lon: -121.9511,
    rating: { championship: 75.5, regular: 73.8, forward: 71.2 },
    slope: { championship: 145, regular: 140, forward: 133 },
    holes: buildHoles([
      [4,  5, 381, 365, 340, "left_to_right",  2, "Opening hole. Green slopes slightly right. Ocean not yet in play.", "right"],
      [5,  7, 502, 485, 460, "downhill",        2, "Downhill second shot. Green wraps around bunker front-left.", "front"],
      [4, 15, 390, 370, 345, "right_to_left",  3, "Famous cliff approach. Never right — ocean. Green tilts left hard.", "left"],
      [4,  9, 331, 315, 295, "relatively_flat", 1, "Short dogleg right. Green is fairly benign. Great birdie chance.", "none"],
      [3, 11, 195, 178, 150, "left_to_right",  3, "Ocean right. Green falls right. Miss left always.", "right"],
      [5,  1, 516, 498, 468, "right_to_left",  2, "Uphill landing zone then right-to-left green from tee level.", "left"],
      [3, 17, 107, 99,  82,  "right_to_left",  4, "Shortest hole on course. Ocean hugs left. Green severe left tilt.", "left"],
      [4,  3, 431, 415, 390, "left_to_right",  3, "Elevated tee. Green sits right, slopes away right-to-left from left bunker.", "right"],
      [4, 13, 505, 480, 452, "double_break",   5, "Hardest par 4 on course. Green slopes both ways depending on pin.", "any"],
      [4,  6, 436, 420, 395, "right_to_left",  3, "Back nine opener. Big green tilts from right rough toward ocean.", "left"],
      [4, 14, 390, 373, 348, "relatively_flat", 2, "Drivable par 4 for scratch+. Green gentle front-to-back only.", "back"],
      [3, 18, 202, 185, 158, "left_to_right",  4, "Ocean full right. Never go right. Green pushed toward cliff.", "right"],
      [4, 10, 399, 380, 355, "downhill",        3, "Downhill approach. Green front is false—don't be short.", "false_front"],
      [5,  8, 573, 551, 524, "left_to_right",  2, "Long par 5. Green wide but runs right toward cliff bank.", "right"],
      [4,  4, 379, 360, 335, "uphill",          2, "Uphill finish. Green elevated. Ball feeds back off platform edges.", "front"],
      [4,  2, 402, 385, 360, "right_to_left",  3, "Cliff alongside. Green slopes toward ocean (left).", "left"],
      [3, 16, 178, 162, 140, "relatively_flat", 2, "Bunker-guarded. Green is one of Pebble's flattest.", "none"],
      [5, 12, 548, 530, 503, "double_break",   4, "Finishing par 5. Green double-breaker. Approach from left center ideal.", "any"],
    ]),
  },

  // ── 3. TPC Sawgrass (Stadium)
  {
    id: "tpc-sawgrass",
    name: "TPC Sawgrass (Stadium Course)",
    location: "Ponte Vedra Beach, FL",
    altitudeFt: 25,
    lat: 30.1975, lon: -81.3958,
    rating: { championship: 76.8, regular: 74.2, forward: 71.8 },
    slope: { championship: 147, regular: 140, forward: 131 },
    holes: buildHoles([
      [4,  9, 423, 405, 380, "right_to_left",  3, "Bermuda grain runs toward water left. Pin left is a sucker.", "left"],
      [5, 15, 532, 515, 490, "left_to_right",  2, "Dogleg left off tee. Green slopes right toward water.", "right"],
      [3, 17, 177, 162, 138, "right_to_left",  3, "Green falls toward front-left bunker. Never above pin.", "left"],
      [4,  5, 384, 365, 342, "left_to_right",  2, "Water left. Green pushes away right to false front trap.", "false_front"],
      [4,  1, 466, 447, 420, "right_to_left",  4, "Stroke index 1. Green tilt toward water hazard left.", "left"],
      [3, 11, 193, 176, 151, "uphill",          2, "Uphill green. Ball drifts back off top tier.", "front"],
      [4,  3, 432, 414, 390, "relatively_flat", 2, "One of the flatter greens. Bunkers guard front corners.", "none"],
      [4, 13, 219, 200, 175, "left_to_right",  3, "Short par 4. Green slopes right toward water.", "right"],
      [5,  7, 583, 562, 530, "double_break",   4, "Back nine reachable par 5. Green double-tier — very difficult.", "any"],
      [4, 17, 424, 407, 385, "right_to_left",  3, "Island green hole (17). Entire perimeter is danger. Center or die.", "any"],
      [5, 11, 548, 526, 500, "left_to_right",  2, "Reachable. Green slopes from left rough toward water right.", "right"],
      [4,  7, 394, 376, 354, "downhill",        3, "Downhill. False front collects everything short.", "false_front"],
      [3,  9, 181, 165, 143, "right_to_left",  4, "Large green but severe right-to-left on back half.", "left"],
      [4,  2, 467, 449, 423, "uphill",          2, "Uphill second shot. Green back-right pin is most manageable.", "back"],
      [4, 18, 447, 429, 404, "left_to_right",  3, "Finishing hole. Green slopes right with lake behind.", "right"],
      [5,  5, 497, 476, 451, "right_to_left",  2, "Drivable for long players. Small green, tight right-to-left tilt.", "left"],
      [4, 13, 385, 368, 346, "relatively_flat", 1, "Benign late hole. Green is one of the flattest on course.", "none"],
      [3, 15, 133, 118,  97,  "downhill",       3, "Short par 3. Green falls front-left. Never short-right.", "front"],
    ]),
  },

  // ── 4. St Andrews (Old Course)
  {
    id: "st-andrews-old",
    name: "St Andrews Links (Old Course)",
    location: "St Andrews, Fife, Scotland",
    altitudeFt: 30,
    lat: 56.3400, lon: -2.8027,
    rating: { championship: 73.1, regular: 71.8, forward: 70.0 },
    slope: { championship: 132, regular: 127, forward: 120 },
    holes: buildHoles([
      [4, 14, 376, 358, 335, "relatively_flat", 1, "Famous shared double green with 18. Sweeping left tilt on back half.", "none"],
      [4, 12, 453, 435, 410, "left_to_right",  2, "Blind tee. Elbow dogleg. Green slopes gently right toward whins.", "right"],
      [4, 18, 397, 380, 355, "right_to_left",  2, "Cartgate Out. Short par 4 with wide shallow green.", "left"],
      [4,  8, 480, 464, 438, "relatively_flat", 2, "Gorse right. Wide green is forgiving. Classic St Andrews.", "none"],
      [5, 16, 568, 550, 518, "left_to_right",  3, "Hole o' Cross. Long par 5 with hidden bunkers.", "right"],
      [4,  4, 416, 398, 374, "right_to_left",  3, "Heathery Hole. Narrow approach. Green falls to left bunker.", "left"],
      [4,  6, 372, 355, 330, "relatively_flat", 1, "High Hole. One of the wider greens. Moderate front-to-back only.", "none"],
      [3,  2, 166, 151, 130, "right_to_left",  3, "Short End. Famous Strath bunker. Never go right above hole.", "left"],
      [4, 10, 352, 335, 312, "downhill",        2, "End Hole. Runs down to shared green. False front is real.", "false_front"],
      [4,  3, 386, 368, 344, "left_to_right",  2, "Bobby Jones Hole. Well-bunkered. Slopes away right.", "right"],
      [3, 11, 174, 158, 136, "relatively_flat", 2, "Short Hole. Most benign par 3 on course. Gentle back slope.", "back"],
      [4,  9, 348, 330, 308, "right_to_left",  3, "Heathery Out. Tight green slopes strongly left.", "left"],
      [4,  7, 465, 448, 422, "relatively_flat", 4, "Hole o' Cross (in). Cauldron bunker a nightmare. Green fairly flat.", "none"],
      [5,  5, 618, 600, 567, "left_to_right",  2, "Long Hole. Classic links par 5. Green sweeps gently right.", "right"],
      [4,  1, 455, 437, 413, "right_to_left",  4, "Cartgate In. Stiff two-shotter. Green breaks toward Eden Estuary.", "left"],
      [3, 13, 163, 148, 126, "relatively_flat", 1, "Corner of the Dyke. Flat green — rare treat at St Andrews.", "none"],
      [4, 17, 495, 478, 453, "right_to_left",  3, "Road Hole. Infamous pot bunker. Never above hole — road behind.", "back"],
      [4, 15, 357, 340, 316, "relatively_flat", 1, "Tom Morris Hole. Wide shared green with 1st. Gentle right-to-left.", "left"],
    ]),
  },

  // ── 5. Torrey Pines South
  {
    id: "torrey-pines-south",
    name: "Torrey Pines Golf Course (South)",
    location: "La Jolla, CA",
    altitudeFt: 360,
    lat: 32.9003, lon: -117.2536,
    rating: { championship: 76.1, regular: 74.0, forward: 71.4 },
    slope: { championship: 144, regular: 137, forward: 128 },
    holes: buildHoles([
      [4,  5, 448, 432, 407, "right_to_left",  3, "Dogleg left. Green tilts toward canyon. Left pin is tight.", "left"],
      [4, 15, 389, 373, 349, "left_to_right",  2, "Two-tiered green. Upper tier runs right. Lower tier holds better.", "right"],
      [3, 11, 199, 183, 157, "relatively_flat", 2, "Ocean views. Green fairly flat. Don't be long.", "back"],
      [4,  7, 495, 476, 450, "right_to_left",  4, "Stroke-index 7. Long two-shotter. Green severely tilted left.", "left"],
      [4,  1, 452, 434, 410, "left_to_right",  3, "Opener. Green complex slopes right. Bunkers both sides.", "right"],
      [5,  3, 530, 511, 486, "downhill",        3, "Downhill into ravine. Don't fly green — it's a cliff.", "back"],
      [4, 13, 453, 435, 411, "right_to_left",  3, "Views of Pacific. Classic fall-left green along canyon.", "left"],
      [4,  9, 439, 421, 398, "uphill",          2, "Uphill into prevailing wind. Green sits elevated. Short is below hole.", "none"],
      [3, 17, 212, 195, 167, "left_to_right",  4, "Difficult par 3 into prevailing westerly. Green slopes hard right.", "right"],
      [4,  8, 460, 443, 418, "right_to_left",  3, "Strong par 4 with barranca right. Green tilts left as always.", "left"],
      [5, 10, 570, 552, 525, "left_to_right",  2, "Birdie hole. Long par 5. Green sweeps gently right.", "right"],
      [3, 16, 177, 160, 135, "relatively_flat", 1, "One of the flatter greens on course.", "none"],
      [4,  4, 468, 450, 425, "right_to_left",  4, "Demanding. Long and tight. Green pulls hard left.", "left"],
      [5, 18, 570, 550, 524, "double_break",   4, "Finishing hole. Famous double-tier green. Below hole always.", "any"],
      [4,  6, 438, 420, 396, "left_to_right",  3, "Canyon left. Green slopes away right — don't over-draw.", "right"],
      [4, 14, 454, 435, 411, "right_to_left",  3, "Consistent left-breaking green with steep back tier.", "left"],
      [4,  2, 406, 388, 364, "relatively_flat", 2, "Fairly forgiving green. Wide and receptive.", "none"],
      [3, 12, 196, 180, 154, "right_to_left",  4, "Long carry over ravine. Green slopes steeply left.", "left"],
    ]),
  },

  // ── 6. Bethpage Black
  {
    id: "bethpage-black",
    name: "Bethpage State Park (Black Course)",
    location: "Farmingdale, NY",
    altitudeFt: 135,
    lat: 40.7459, lon: -73.4551,
    rating: { championship: 78.1, regular: 76.0, forward: 73.5 },
    slope: { championship: 152, regular: 147, forward: 140 },
    holes: buildHoles([
      [4,  3, 430, 415, 392, "right_to_left",  3, "Green tilts back-right to front-left. Front pin plays tricks.", "left"],
      [4, 13, 389, 374, 350, "left_to_right",  3, "Narrow second shot. Green pushes right.", "right"],
      [3,  9, 230, 210, 181, "relatively_flat", 2, "Long carry. Green is wide and flat — relief on this beast.", "none"],
      [5, 17, 517, 500, 474, "left_to_right",  3, "Birdie chance. Green sweeps right behind bunkers.", "right"],
      [4,  1, 478, 460, 433, "right_to_left",  4, "Stroke-index 1. Brutal opener. Green severe left-tilt.", "left"],
      [5, 11, 667, 642, 612, "downhill",        3, "Longest hole. Green rolls hard downhill front-to-back.", "back"],
      [4,  5, 494, 475, 449, "right_to_left",  4, "Stroke-index 5 for a reason. Another long two-shotter left-breaking.", "left"],
      [3, 15, 209, 191, 164, "left_to_right",  3, "Bunkers surround. Green tilts right — favor left side.", "right"],
      [4,  7, 418, 401, 378, "relatively_flat", 2, "Shorter hole provides some breathing room. Near-flat green.", "none"],
      [4,  2, 453, 436, 411, "right_to_left",  3, "Second nine opener. Familiar left-breaking Bethpage green.", "left"],
      [4, 16, 435, 418, 394, "left_to_right",  3, "Severely bunkered. Green slopes right. Never miss right.", "right"],
      [3,  8, 207, 188, 162, "right_to_left",  4, "Water hazard lurks. Green tilts hard left from right bunker.", "left"],
      [5, 14, 567, 547, 519, "left_to_right",  2, "Generous landing zone. Green opens up from left center.", "right"],
      [4, 18, 411, 395, 372, "downhill",        3, "Stadium finish. Downhill green sweeps toward gallery.", "front"],
      [4,  6, 408, 392, 369, "uphill",          2, "Uphill green. Ball feeds back from back pin easily.", "back"],
      [4, 10, 492, 474, 449, "right_to_left",  3, "Brutish second shot. Green severely tilted.", "left"],
      [4, 12, 498, 479, 453, "left_to_right",  3, "Another long, demanding par 4. Green goes right.", "right"],
      [3,  4, 241, 222, 193, "relatively_flat", 2, "One of Bethpage's more forgiving greens.", "none"],
    ]),
  },

  // ── 7. Erin Hills (US Open 2017 venue)
  {
    id: "erin-hills",
    name: "Erin Hills Golf Course",
    location: "Hartford, WI",
    altitudeFt: 1000,
    lat: 43.1800, lon: -88.3369,
    rating: { championship: 76.9, regular: 74.4, forward: 72.1 },
    slope: { championship: 143, regular: 138, forward: 130 },
    holes: buildHoles([
      [4,  5, 453, 434, 408, "right_to_left",  3, "Links-style. Green rolls away left with prevailing wind.", "left"],
      [5, 17, 614, 591, 563, "left_to_right",  2, "Longest hole. Green wide and sweeps gently right.", "right"],
      [3, 11, 233, 213, 182, "relatively_flat", 1, "Wide links par 3. Green is among flattest on course.", "none"],
      [4,  3, 468, 447, 422, "right_to_left",  3, "Rolling terrain. Green tilts away hard left.", "left"],
      [5,  7, 567, 546, 517, "double_break",   4, "Reachable. Two-tier approach green. Very tricky.", "any"],
      [4, 15, 434, 415, 392, "downhill",        3, "Downhill finish. Green releases toward rough back-right.", "back"],
      [3,  9, 199, 181, 155, "left_to_right",  3, "Famous scenic hole. Green falls toward valley right.", "right"],
      [4,  1, 489, 469, 442, "right_to_left",  4, "Stroke-index 1. Long, demanding. Green tilts severely left.", "left"],
      [4, 13, 461, 441, 416, "uphill",          2, "Uphill approach. Green seated on plateau — runs back.", "back"],
      [4,  6, 430, 411, 387, "left_to_right",  3, "Gorse-lined. Green slopes right. Bunker collects left misses.", "right"],
      [5, 18, 558, 537, 510, "right_to_left",  3, "Finishing par 5. Grandstand lines left. Green breaks left.", "left"],
      [3, 16, 214, 197, 170, "right_to_left",  3, "Long carry. Green heavily favors left roll.", "left"],
      [4,  2, 458, 439, 415, "relatively_flat", 2, "Generous fairway. Green is forgiving for Erin Hills.", "none"],
      [4, 10, 447, 428, 403, "left_to_right",  3, "Green slopes away right — favor left of center approach.", "right"],
      [4, 14, 425, 407, 384, "downhill",        2, "Downhill second. Never get behind this pin — rolls forever.", "back"],
      [4, 12, 450, 432, 408, "right_to_left",  3, "Consistent left-break throughout.", "left"],
      [5,  8, 596, 575, 547, "left_to_right",  2, "Accessible par 5. Green sweeps right of center.", "right"],
      [3,  4, 223, 204, 176, "relatively_flat", 1, "Flatter green, nice respite. Bunkers left and right.", "none"],
    ]),
  },

  // ── 8. Harbour Town Golf Links
  {
    id: "harbour-town",
    name: "Harbour Town Golf Links",
    location: "Hilton Head Island, SC",
    altitudeFt: 15,
    lat: 32.1366, lon: -80.8076,
    rating: { championship: 74.0, regular: 72.1, forward: 69.8 },
    slope: { championship: 136, regular: 130, forward: 123 },
    holes: buildHoles([
      [4,  9, 414, 396, 372, "left_to_right",  2, "Tree-lined. Green slopes gently right — ocean influence.", "right"],
      [5, 17, 503, 483, 458, "right_to_left",  1, "Birdie hole. Short par 5. Green rolls left.", "left"],
      [3, 15, 165, 150, 128, "relatively_flat", 2, "Short and charming par 3. Flat green rewards patience.", "none"],
      [4,  3, 454, 436, 411, "right_to_left",  4, "Tree-lined fairway. Green falls toward water left.", "left"],
      [4,  7, 430, 413, 390, "left_to_right",  3, "Green slopes away from trees right. Bunker collects left.", "right"],
      [3, 11, 185, 168, 144, "relatively_flat", 2, "One of the flatter par 3s. Water right cautions.", "none"],
      [4,  5, 358, 340, 318, "right_to_left",  3, "Drivable for scratch. Green feeds toward marsh.", "left"],
      [5,  1, 575, 555, 528, "left_to_right",  2, "Opener. Wide fairway. Green sweeps right gently.", "right"],
      [4, 13, 418, 400, 377, "downhill",        3, "Scenic. Green runs downhill past false front.", "false_front"],
      [4,  4, 452, 434, 410, "right_to_left",  4, "Demanding two-shotter. Green breaks toward tidal creek.", "left"],
      [4, 14, 372, 355, 332, "left_to_right",  2, "Shorter hole — tempting to attack. Green tilts right.", "right"],
      [3, 16, 175, 159, 136, "right_to_left",  3, "Water right. Green breaks away from danger — toward left.", "left"],
      [5, 18, 478, 460, 435, "relatively_flat", 1, "Famous lighthouse finish. Tiny peninsula green — every side is trouble.", "any"],
      [4,  6, 420, 403, 380, "right_to_left",  3, "Green falls toward lagoon left.", "left"],
      [3, 10, 197, 180, 155, "left_to_right",  3, "Longer par 3. Green slopes right away from marsh.", "right"],
      [4, 12, 395, 378, 355, "relatively_flat", 2, "Mid-round breather. Flat green, manageable.", "none"],
      [4,  2, 408, 392, 369, "right_to_left",  3, "Tree-lined. Green tilts toward tidal area.", "left"],
      [4, 16, 438, 420, 397, "downhill",        3, "Downhill par 4. Green runs toward pond.", "front"],
    ]),
  },

  // ── 9. Whistling Straits (Straits Course)
  {
    id: "whistling-straits",
    name: "Whistling Straits (Straits Course)",
    location: "Kohler, WI",
    altitudeFt: 650,
    lat: 43.8461, lon: -87.7298,
    rating: { championship: 76.6, regular: 74.3, forward: 72.0 },
    slope: { championship: 151, regular: 145, forward: 137 },
    holes: buildHoles([
      [4, 11, 421, 403, 380, "right_to_left",  3, "Bluff-side opener. Green rolls toward Lake Michigan (left).", "left"],
      [5,  7, 595, 573, 544, "left_to_right",  2, "Along the lake. Long approach. Green sweeps right toward fescue.", "right"],
      [3, 13, 177, 161, 138, "relatively_flat", 1, "Short par 3. Green perched on bluff with relatively flat surface.", "none"],
      [4,  3, 490, 471, 446, "right_to_left",  4, "Stroke-index 3. Links-style. Green falls toward lake hard.", "left"],
      [3, 15, 222, 203, 176, "left_to_right",  4, "Long forced carry. Green tilts right toward grass bunker complex.", "right"],
      [4,  1, 461, 443, 418, "right_to_left",  4, "Hardest on card. Green runs away toward bunker complex.", "left"],
      [5,  9, 618, 596, 568, "left_to_right",  3, "Long par 5 along the shore. Green wide and sweeps right.", "right"],
      [4,  5, 413, 395, 372, "relatively_flat", 2, "One of the more forgiving greens on course.", "none"],
      [4, 17, 440, 422, 399, "right_to_left",  3, "Penultimate hole. Green falls toward lake.", "left"],
      [4,  2, 440, 422, 399, "left_to_right",  3, "Back nine opener. Green slopes right toward bunker collection.", "right"],
      [3, 18, 223, 205, 178, "right_to_left",  4, "Famous island-style par 3 finish. Green severely left-breaking.", "left"],
      [4, 12, 454, 436, 413, "downhill",        3, "Downhill. Green rolls toward lake.", "back"],
      [5, 16, 551, 531, 503, "double_break",   5, "Dramatic ridge-green. Double break — choose side carefully.", "any"],
      [4, 10, 430, 412, 389, "right_to_left",  3, "Classic links two-shotter. Green tilts toward fescue.", "left"],
      [4, 14, 394, 377, 354, "left_to_right",  2, "Reachable green for scratch. Sweeps gently right.", "right"],
      [3,  6, 218, 200, 173, "relatively_flat", 2, "Mid-round par 3. Green is fairly flat — enjoyable.", "none"],
      [4,  4, 477, 459, 434, "right_to_left",  4, "Demanding mid-round hole. Falls toward lake.", "left"],
      [4,  8, 481, 462, 437, "left_to_right",  3, "Stiff dogleg. Green pushed right toward steep drop.", "right"],
    ]),
  },

  // ── 10. Bay Hill Club & Lodge
  {
    id: "bay-hill",
    name: "Bay Hill Club & Lodge",
    location: "Orlando, FL",
    altitudeFt: 95,
    lat: 28.4633, lon: -81.5039,
    rating: { championship: 75.8, regular: 73.6, forward: 71.2 },
    slope: { championship: 142, regular: 136, forward: 128 },
    holes: buildHoles([
      [4, 5, 441, 423, 398, "left_to_right",  3, "Green tilts right away from sand trap.", "right"],
      [5, 3, 568, 547, 519, "right_to_left",  2, "Long par 5. Green funnels toward left rough.", "left"],
      [3,11, 219, 199, 172, "relatively_flat", 1, "Lake right. Flat green — rare relief hole.", "none"],
      [4, 1, 470, 451, 426, "right_to_left",  4, "Long demanding opener. Green breaks hard left.", "left"],
      [4, 7, 408, 391, 368, "left_to_right",  3, "Dogleg left. Green falls right toward lake.", "right"],
      [5,15, 587, 566, 537, "left_to_right",  2, "Reachable par 5. Green sweeps right toward water.", "right"],
      [4, 9, 451, 432, 408, "right_to_left",  4, "Green falls hard toward sand left.", "left"],
      [3,17, 207, 190, 164, "right_to_left",  4, "Island green par 3 over water. Green slopes steeply left.", "left"],
      [4,13, 454, 436, 411, "downhill",        3, "Downhill. Green runs toward gallery area below.", "front"],
      [4, 6, 415, 398, 375, "left_to_right",  3, "Green pushed right by mounding.", "right"],
      [5,11, 562, 541, 513, "right_to_left",  2, "Birdie hole. Green funnels left of center.", "left"],
      [3,15, 170, 155, 131, "relatively_flat", 2, "Short par 3. Near-flat surface.", "none"],
      [4, 2, 404, 387, 364, "right_to_left",  3, "Classic Bay Hill two-shotter. Green breaks left.", "left"],
      [4,18, 441, 424, 399, "downhill",        3, "Finishing hole over lake. Green downhill — don't go long.", "back"],
      [4, 4, 482, 463, 438, "right_to_left",  4, "Long and demanding. Green tilts severely left.", "left"],
      [4,12, 426, 409, 386, "left_to_right",  3, "Green slopes away right toward hazard.", "right"],
      [5, 8, 571, 551, 523, "left_to_right",  2, "Bombers' hole. Wide green sweeps right.", "right"],
      [4,16, 411, 393, 370, "relatively_flat", 1, "Most forgiving green in the stretch.", "none"],
    ]),
  },

  // ── 11. Kiawah Island (Ocean Course)
  {
    id: "kiawah-ocean",
    name: "Kiawah Island (Ocean Course)",
    location: "Kiawah Island, SC",
    altitudeFt: 15,
    lat: 32.6077, lon: -80.0849,
    rating: { championship: 79.6, regular: 77.2, forward: 74.5 },
    slope: { championship: 155, regular: 149, forward: 142 },
    holes: buildHoles([
      [4, 5, 430, 412, 388, "left_to_right",  3, "Ocean right. Green pushed hard right by prevailing sea breeze.", "right"],
      [5, 1, 596, 575, 546, "right_to_left",  2, "Atlantic views. Green feeds left toward rough.", "left"],
      [3,13, 197, 180, 155, "relatively_flat", 2, "One of the few forgiving holes. Green is fairly flat.", "none"],
      [4, 9, 479, 461, 436, "right_to_left",  4, "Stroke-index 9 but it's brutal. Ocean wind makes approach tough.", "left"],
      [4, 3, 455, 437, 413, "left_to_right",  3, "Green pushed by sea right. Bunker collects short left.", "right"],
      [5,11, 563, 541, 514, "left_to_right",  2, "Risk-reward par 5. Green sweeps right toward water.", "right"],
      [3,17, 229, 210, 183, "right_to_left",  5, "Famous. Ocean left. Green severely tilted left — worst putt on course.", "left"],
      [4, 7, 465, 446, 421, "right_to_left",  4, "Long and exposed. Green breaks left toward ocean.", "left"],
      [4,15, 421, 403, 380, "left_to_right",  3, "Green swept right by consistent afternoon breeze.", "right"],
      [4, 6, 455, 437, 412, "right_to_left",  3, "Back nine. Green tilts left consistently.", "left"],
      [5,16, 579, 558, 530, "double_break",   5, "Wild double-tier — break varies by half. Read carefully.", "any"],
      [3,10, 215, 197, 170, "left_to_right",  4, "All-or-nothing par 3. Green hard right — bail-out is ocean.", "right"],
      [4, 2, 463, 445, 421, "right_to_left",  4, "Strong wind hole. Green severely left-breaking.", "left"],
      [4,14, 425, 407, 384, "downhill",        3, "Downhill approach. Green runs toward dunes.", "back"],
      [4, 8, 444, 426, 402, "left_to_right",  3, "Green opens up from left center.", "right"],
      [4,18, 448, 429, 405, "right_to_left",  4, "Stadium finish. Crowd and ocean breeze both push left.", "left"],
      [5,12, 585, 563, 535, "left_to_right",  2, "Long and exposed. Green sweeps right in afternoon sun.", "right"],
      [3, 4, 205, 187, 161, "relatively_flat", 2, "Mid-front nine par 3. Green is relatively forgiving.", "none"],
    ]),
  },

  // ── 12. Muirfield Village
  {
    id: "muirfield-village",
    name: "Muirfield Village Golf Club",
    location: "Dublin, OH",
    altitudeFt: 890,
    lat: 40.1247, lon: -83.1113,
    rating: { championship: 76.3, regular: 74.1, forward: 71.7 },
    slope: { championship: 148, regular: 142, forward: 134 },
    holes: buildHoles([
      [4, 9, 446, 428, 404, "right_to_left",  3, "Stream guards front. Green tilts left toward water.", "left"],
      [5, 7, 570, 550, 521, "left_to_right",  2, "Reachable. Green sweeps gently right.", "right"],
      [3,15, 204, 186, 161, "relatively_flat", 2, "Flat green is a gift in this demanding layout.", "none"],
      [4, 1, 475, 456, 431, "right_to_left",  4, "Stroke-index 1. Creek at rear. Green breaks steeply left.", "left"],
      [4, 3, 462, 444, 419, "left_to_right",  3, "Well-bunkered. Green pushes right toward stream.", "right"],
      [5,11, 538, 518, 493, "right_to_left",  1, "Birdie chance. Green tilts left.", "left"],
      [4,17, 430, 412, 389, "downhill",        3, "Downhill approach. Green sweeps toward stream below.", "front"],
      [3, 9, 183, 166, 143, "right_to_left",  3, "Short par 3. Creek behind. Green falls toward front-left.", "left"],
      [4, 5, 416, 399, 376, "left_to_right",  2, "Dogleg right. Green opens up from left center approach.", "right"],
      [4,13, 461, 442, 418, "right_to_left",  3, "Tough stretch hole. Green consistently breaks left.", "left"],
      [4,11, 534, 514, 488, "left_to_right",  4, "Long, demanding mid-round hole. Green sweeps right.", "right"],
      [3, 7, 199, 182, 157, "relatively_flat", 2, "Near-flat green on par 3.", "none"],
      [5,15, 559, 539, 511, "right_to_left",  2, "Classic Nicklaus par 5. Green breaks left at end.", "left"],
      [4,18, 444, 426, 402, "downhill",        4, "Grandstand finish. Downhill green — don't go long.", "back"],
      [4, 6, 433, 415, 392, "right_to_left",  3, "Wooded backdrop. Green tilts toward creek.", "left"],
      [4,16, 460, 441, 417, "left_to_right",  3, "Back nine two-shotter. Green slopes right.", "right"],
      [4, 2, 403, 385, 362, "right_to_left",  3, "Creek in play from tee. Green breaks toward stream.", "left"],
      [4,14, 363, 346, 324, "relatively_flat", 1, "Short par 4. Green is the flattest on course.", "none"],
    ]),
  },

  // ── 13. Riviera Country Club
  {
    id: "riviera",
    name: "Riviera Country Club",
    location: "Pacific Palisades, CA",
    altitudeFt: 110,
    lat: 34.0603, lon: -118.5239,
    rating: { championship: 75.5, regular: 73.3, forward: 71.0 },
    slope: { championship: 145, regular: 139, forward: 131 },
    holes: buildHoles([
      [4, 7, 501, 482, 456, "right_to_left",  4, "Long par 4. Green breaks toward native left rough.", "left"],
      [4, 3, 470, 452, 427, "left_to_right",  3, "Classic Riviera. Green tilts away from bunkers right.", "right"],
      [3,13, 218, 200, 174, "relatively_flat", 1, "One of course's flatter greens.", "none"],
      [4, 5, 398, 380, 357, "right_to_left",  3, "Bunker-guarded. Green falls toward native area left.", "left"],
      [5, 1, 573, 553, 525, "left_to_right",  2, "Par 5 opener. Long. Green sweeps right.", "right"],
      [3,15, 176, 160, 137, "right_to_left",  3, "Bunker island green. Green tilts hard left.", "left"],
      [4, 9, 415, 397, 374, "downhill",        3, "Downhill. Eucalyptus trees frame approach. Green runs forward.", "false_front"],
      [4,17, 450, 431, 408, "right_to_left",  4, "Classic Riviera par 4 — severely left-breaking green.", "left"],
      [4,11, 490, 470, 445, "left_to_right",  3, "Another demanding two-shotter. Green falls right.", "right"],
      [4, 2, 468, 449, 425, "right_to_left",  4, "Stroke-index 2. Tight and tough. Green breaks left.", "left"],
      [5,18, 460, 441, 417, "left_to_right",  3, "Drivable par 5 for big hitters. Green slopes right.", "right"],
      [3, 6, 201, 183, 158, "right_to_left",  3, "Par 3 over canyon. Green tilts left.", "left"],
      [4,16, 438, 420, 397, "right_to_left",  3, "Classic Riviera two-shotter. Left-breaking green.", "left"],
      [4,14, 415, 397, 374, "left_to_right",  2, "Bunkers left. Green sweeps right toward native rough.", "right"],
      [4, 4, 436, 418, 395, "right_to_left",  3, "Tree-lined. Green breaks toward garden left.", "left"],
      [4,10, 315, 298, 277, "relatively_flat", 1, "Short par 4. Most forgiving green on course.", "none"],
      [5, 8, 589, 568, 540, "double_break",   4, "Long par 5 — double-tier green is very tricky.", "any"],
      [4,12, 396, 379, 356, "left_to_right",  2, "Short two-shotter. Green pushed right.", "right"],
    ]),
  },

  // ── 14. Oakmont Country Club
  {
    id: "oakmont",
    name: "Oakmont Country Club",
    location: "Oakmont, PA",
    altitudeFt: 885,
    lat: 40.5280, lon: -79.8357,
    rating: { championship: 78.8, regular: 76.7, forward: 74.1 },
    slope: { championship: 155, regular: 149, forward: 142 },
    holes: buildHoles([
      [4, 3, 482, 464, 439, "right_to_left",  4, "Church Pew bunkers. Green severely tilted left — fastest on course.", "left"],
      [4,11, 343, 326, 304, "left_to_right",  2, "Short but treacherous. Green tilts right toward rough.", "right"],
      [3,15, 183, 166, 142, "relatively_flat", 1, "Oakmont's flattest green — still very fast.", "none"],
      [5, 9, 609, 587, 558, "right_to_left",  2, "Long par 5. Green breaks left on back half.", "left"],
      [4, 1, 485, 466, 441, "left_to_right",  3, "Green tilts right toward rough. Never above this hole.", "right"],
      [4, 5, 389, 371, 348, "right_to_left",  4, "Tiny green. Any miss is brutal. Severe left-tilt.", "left"],
      [3,13, 194, 177, 153, "right_to_left",  3, "All three-spots are dangerous here. Left-tilt green.", "left"],
      [4, 7, 479, 460, 435, "left_to_right",  3, "Church Pew hole. Green pushed far right — be exact.", "right"],
      [4, 9, 501, 482, 457, "right_to_left",  4, "Closing front nine. Another left-breaking nightmare.", "left"],
      [4, 6, 435, 417, 393, "relatively_flat", 2, "One of the few manageable greens at Oakmont.", "none"],
      [5,17, 667, 645, 616, "double_break",   5, "Longest hole in USGA competition. Double-break green.", "any"],
      [3, 8, 288, 267, 238, "left_to_right",  4, "Long par 3. Green tilts right — very fast.", "right"],
      [4,18, 484, 465, 440, "right_to_left",  3, "Finishing hole. Green falls back left. Don't be above hole.", "left"],
      [4,16, 440, 422, 398, "left_to_right",  3, "Green consistently slopes right on back nine.", "right"],
      [4, 4, 423, 405, 382, "right_to_left",  3, "Bunker-framed. Green tilts left toward sand complex.", "left"],
      [4,14, 358, 341, 319, "relatively_flat", 2, "Short par 4. Green still very fast but fairly flat.", "none"],
      [4,12, 667, 645, 614, "right_to_left",  3, "Unusually long par 4 at times. Green breaks left as expected.", "left"],
      [3,10, 224, 205, 178, "right_to_left",  4, "Par 3 on back nine. Very fast left-breaking surface.", "left"],
    ]),
  },

  // ── 15. Shinnecock Hills Golf Club
  {
    id: "shinnecock-hills",
    name: "Shinnecock Hills Golf Club",
    location: "Southampton, NY",
    altitudeFt: 60,
    lat: 40.8878, lon: -72.4460,
    rating: { championship: 77.0, regular: 74.8, forward: 72.4 },
    slope: { championship: 144, regular: 138, forward: 130 },
    holes: buildHoles([
      [4, 5, 474, 455, 430, "right_to_left",  3, "Links-style. Green falls toward ocean (left).", "left"],
      [5, 3, 540, 521, 494, "left_to_right",  2, "Exposed. Green sweeps right with prevailing wind.", "right"],
      [3,13, 190, 173, 148, "relatively_flat", 1, "Flat green by Shinnecock standards. Take the par and go.", "none"],
      [4, 1, 475, 456, 431, "right_to_left",  4, "Classic opener. Green tilts toward ocean west of fairway.", "left"],
      [4, 7, 441, 423, 399, "left_to_right",  3, "Exposed plateau green. Pushes right in the wind.", "right"],
      [5,15, 479, 460, 435, "right_to_left",  2, "Short par 5. Green breaks left. Aggressive play earns eagles.", "left"],
      [3,11, 245, 224, 197, "right_to_left",  5, "Long forced carry. Famous severe left-breaking green.", "left"],
      [4, 9, 447, 429, 405, "left_to_right",  3, "Exposed plateau. Green sweeps right toward Atlantic.", "right"],
      [4,17, 429, 411, 388, "relatively_flat", 2, "Wind-battered but flatter green than most.", "none"],
      [4, 2, 474, 455, 430, "right_to_left",  3, "Windswept. Green falls toward estuary.", "left"],
      [4,18, 461, 443, 419, "left_to_right",  3, "Bunker right. Green slopes right toward clubhouse.", "right"],
      [3, 6, 241, 221, 193, "right_to_left",  4, "Long carry. Wind usually in face. Green tilts left.", "left"],
      [4,16, 437, 419, 396, "left_to_right",  3, "Green pushed right by slope.", "right"],
      [4,14, 453, 435, 410, "right_to_left",  3, "Back nine par 4. Green consistently breaks left.", "left"],
      [5, 8, 573, 552, 524, "double_break",   4, "Complex par 5. Two-tier green in the breeze.", "any"],
      [4,12, 469, 450, 426, "right_to_left",  3, "Classic links two-shotter. Green falls left.", "left"],
      [4, 4, 395, 378, 355, "relatively_flat", 2, "Shorter hole in the mix. Green is forgiving.", "none"],
      [4,10, 412, 394, 371, "left_to_right",  2, "Opening back nine. Green slopes right toward rough.", "right"],
    ]),
  },

  // ── 16. Bandon Dunes (Bandon Dunes Course)
  {
    id: "bandon-dunes",
    name: "Bandon Dunes Golf Resort (Bandon Dunes Course)",
    location: "Bandon, OR",
    altitudeFt: 80,
    lat: 43.1233, lon: -124.4447,
    rating: { championship: 75.7, regular: 73.4, forward: 71.0 },
    slope: { championship: 140, regular: 134, forward: 127 },
    holes: buildHoles([
      [4, 5, 420, 401, 377, "left_to_right",  3, "Links opener. Green pushed by Pacific sea breeze.", "right"],
      [5, 3, 528, 508, 482, "right_to_left",  1, "Birdie chance. Green funnels left.", "left"],
      [3,13, 185, 168, 144, "relatively_flat", 2, "Flat links par 3. Wind the factor, not slope.", "none"],
      [4, 9, 455, 436, 411, "right_to_left",  4, "Ocean-side. Green falls toward Pacific.", "left"],
      [4, 7, 412, 394, 371, "left_to_right",  3, "Green pushed oceanward (right).", "right"],
      [5,11, 576, 555, 527, "left_to_right",  2, "Exposed par 5. Green sweeps right with wind.", "right"],
      [3,15, 208, 190, 164, "right_to_left",  4, "Famous cliff-side par 3. Green tilts left hard.", "left"],
      [4, 1, 479, 460, 435, "right_to_left",  4, "Stroke index 1. Demanding start. Green falls oceanward.", "left"],
      [4,17, 448, 430, 406, "downhill",        3, "Downhill ocean views. Green runs off back hard.", "back"],
      [4, 6, 428, 410, 387, "left_to_right",  3, "Consistent right-sweeping green.", "right"],
      [4,18, 439, 421, 397, "right_to_left",  3, "Finishing hole into prevailing wind. Green breaks left.", "left"],
      [3,16, 175, 159, 136, "relatively_flat", 1, "Short par 3. Near-flat green.", "none"],
      [4, 2, 448, 430, 406, "right_to_left",  3, "Classic links par 4. Green tilts oceanward.", "left"],
      [4,10, 394, 377, 354, "left_to_right",  2, "Green opened up from left-center. Sweeps right.", "right"],
      [5,14, 563, 542, 515, "left_to_right",  2, "Reachable with wind. Green feeds right.", "right"],
      [4,12, 431, 413, 390, "right_to_left",  3, "Back nine classic. Green falls left.", "left"],
      [4, 8, 395, 378, 355, "relatively_flat", 2, "Mid-round breather. Green is fairly flat.", "none"],
      [4, 4, 450, 431, 407, "right_to_left",  3, "Clifftop views. Green tilts toward sea.", "left"],
    ]),
  },

  // ── 17. Shadow Creek (Las Vegas)
  {
    id: "shadow-creek",
    name: "Shadow Creek Golf Course",
    location: "North Las Vegas, NV",
    altitudeFt: 2100,
    lat: 36.2697, lon: -115.0878,
    rating: { championship: 76.1, regular: 73.9, forward: 71.4 },
    slope: { championship: 147, regular: 141, forward: 133 },
    holes: buildHoles([
      [4, 5, 447, 429, 404, "right_to_left",  3, "Creek runs alongside. Green tilts toward water left.", "left"],
      [5, 3, 569, 549, 521, "left_to_right",  1, "Birdie opportunity. Green sweeps right toward bunkers.", "right"],
      [3,13, 196, 179, 154, "relatively_flat", 2, "Waterfall nearby but green is fairly flat.", "none"],
      [4, 1, 471, 453, 428, "right_to_left",  4, "Famous opener. Green falls toward creek left.", "left"],
      [4, 7, 434, 416, 393, "left_to_right",  3, "Manicured fairway. Green sweeps right toward grassy bank.", "right"],
      [5,11, 553, 533, 506, "right_to_left",  2, "Reachable. Green funnels left.", "left"],
      [3,17, 188, 171, 147, "right_to_left",  3, "Par 3 across water. Green tilts left.", "left"],
      [4, 9, 437, 419, 396, "left_to_right",  3, "Green pushed right by land contour.", "right"],
      [4,15, 452, 434, 410, "right_to_left",  4, "Demanding back nine. Green breaks hard left.", "left"],
      [4, 6, 418, 400, 377, "left_to_right",  3, "Desert backdrop. Green slopes right.", "right"],
      [4,18, 448, 430, 406, "downhill",        3, "Dramatic finish through trees. Downhill green runs toward creek.", "front"],
      [3, 4, 205, 188, 163, "relatively_flat", 2, "Mid-round par 3. Near-flat green.", "none"],
      [5,12, 565, 544, 517, "left_to_right",  2, "Lush par 5. Green widens right.", "right"],
      [4,16, 458, 440, 416, "right_to_left",  3, "Green falls toward water feature left.", "left"],
      [4, 8, 409, 392, 369, "relatively_flat", 2, "Shorter hole. Green is one of course's most forgiving.", "none"],
      [4, 2, 451, 433, 409, "right_to_left",  3, "Elevated tee. Green tilts toward creek.", "left"],
      [4,10, 427, 409, 386, "left_to_right",  3, "Back nine opener. Green slopes right.", "right"],
      [4,14, 369, 353, 331, "right_to_left",  1, "Shortest par 4. Green still breaks left.", "left"],
    ]),
  },

  // ── 18. Winged Foot West
  {
    id: "winged-foot-west",
    name: "Winged Foot Golf Club (West Course)",
    location: "Mamaroneck, NY",
    altitudeFt: 340,
    lat: 40.9632, lon: -73.7316,
    rating: { championship: 76.6, regular: 74.4, forward: 72.0 },
    slope: { championship: 144, regular: 138, forward: 131 },
    holes: buildHoles([
      [4, 5, 450, 432, 408, "right_to_left",  3, "Classic A.W. Tillinghast. Green tilts left toward rough.", "left"],
      [5, 3, 453, 434, 410, "left_to_right",  1, "Short par 5. Green sweeps right toward bunker.", "right"],
      [3,13, 216, 198, 172, "relatively_flat", 2, "Short par 3. Green is relatively flat.", "none"],
      [4, 1, 452, 434, 410, "right_to_left",  4, "Stroke index 1. Long, demanding. Green falls left.", "left"],
      [4, 9, 521, 502, 476, "right_to_left",  4, "One of the longest par 4s in major history. Green breaks hard left.", "left"],
      [5, 7, 150, 136, 115, "left_to_right",  1, "Shortest hole on course. Par 3. Near-flat but treacherous bunkers.", "none"],
      [4,15, 417, 399, 376, "left_to_right",  3, "Green pushed right away from trees.", "right"],
      [3, 3, 445, 427, 403, "right_to_left",  3, "Bunker complex surrounds. Green tilts left consistently.", "left"],
      [4,11, 386, 369, 347, "relatively_flat", 2, "Shorter hole. Green is more forgiving.", "none"],
      [4, 2, 453, 435, 411, "right_to_left",  3, "Back nine opener. Green breaks hard left.", "left"],
      [4,17, 513, 494, 469, "right_to_left",  4, "Monster par 4. Green consistently falls left.", "left"],
      [3, 9, 206, 188, 163, "right_to_left",  3, "Par 3 over hill. Green tilts left to rough.", "left"],
      [5,18, 448, 430, 406, "downhill",        3, "Famous 18th. Downhill, then uphill. Grandstand left. Green rolls away.", "front"],
      [4,16, 420, 402, 379, "left_to_right",  3, "Back nine. Green sweeps right.", "right"],
      [4, 6, 324, 308, 287, "relatively_flat", 1, "Short par 4. Drivable for pros. Green flat.", "none"],
      [4,14, 418, 400, 377, "right_to_left",  3, "Classic stretch. Green breaks toward left rough.", "left"],
      [4,12, 395, 378, 355, "left_to_right",  2, "Green widens right. Bunker left collects misses.", "right"],
      [4,10, 436, 418, 394, "right_to_left",  3, "Consistent left-break throughout back nine.", "left"],
    ]),
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function searchCourses(query: string): GolfCourse[] {
  const q = query.toLowerCase().trim();
  if (!q) return COURSE_LIBRARY;
  return COURSE_LIBRARY.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q) ||
      c.id.includes(q)
  );
}

export function getCourseById(id: string): GolfCourse | null {
  return COURSE_LIBRARY.find((c) => c.id === id) ?? null;
}

export function getCoursePar(course: GolfCourse): number {
  return course.holes.reduce((s, h) => s + h.par, 0);
}

export function getCourseYardage(course: GolfCourse, tee: TeeBox): number {
  return course.holes.reduce((s, h) => s + h.yards[tee], 0);
}

/** Build a break description string for the caddie reading */
export function describeBreak(green: GreenData): string {
  const dirMap: Record<BreakDirection, string> = {
    left_to_right:     "breaks left to right",
    right_to_left:     "breaks right to left",
    uphill:            "plays uphill — expect putts to be slower",
    downhill:          "runs downhill — putts are fast, be cautious coming back",
    severe_left:       "breaks severely left",
    severe_right:      "breaks severely right",
    double_break:      "has a double break — read each putt carefully",
    relatively_flat:   "is relatively flat with minimal break",
  };
  const sevMap = (sev: number) => {
    if (sev === 0) return "minimal";
    if (sev <= 1) return "subtle";
    if (sev <= 3) return "moderate";
    if (sev <= 5) return "significant";
    return "severe";
  };
  return `${dirMap[green.breakDirection]} (${sevMap(green.breakSeverityInches)} — ~${green.breakSeverityInches}" per 10 ft). ${green.slopeNote}`;
}
