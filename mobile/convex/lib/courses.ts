/**
 * Static golf course library.
 * Each course has 18 holes with:
 *   - par, stroke index (difficulty rank), and yardages per tee box
 *   - green data: dominant break direction + severity (feet of break per 10 ft of putt) + slope description
 *
 * PAR AND CHAMPIONSHIP YARDAGE are transcribed from published scorecards, one
 * card per course, listed below. They carried over from the web app as
 * invented data and were wrong in ways a golfer would catch: TPC Sawgrass had
 * the island green as a 385-yard par 4 and its 18th as a 133-yard par 3 - the
 * two holes swapped - St Andrews played the Road Hole as a par 5, Riviera's
 * drivable 10th had moved to the 16th, and eight of the eighteen courses
 * totalled the wrong par.
 *
 *   augusta-national     2026 Masters card                par 72, 7,565
 *   pebble-beach         2026 AT&T Pro-Am card            par 72, 6,989
 *   tpc-sawgrass         2026 Players card                par 72, 7,352
 *   st-andrews-old       Open Championship card           par 72, 7,318
 *   torrey-pines-south   2026 Farmers Insurance Open      par 72, 7,765
 *   bethpage-black       standard blue-tee card           par 71, 7,468
 *   erin-hills           2017 US Open card                par 72, 7,741
 *   harbour-town         2026 RBC Heritage card           par 71, 7,243
 *   whistling-straits    black-tee card                   par 72, 7,790
 *   bay-hill             2026 Arnold Palmer Invitational  par 72, 7,466
 *   kiawah-ocean         PGA Championship card            par 72, 7,876
 *   muirfield-village    2026 Memorial card               par 72, 7,569
 *   riviera              2026 Genesis Invitational        par 71, 7,383
 *   oakmont              2025 US Open card                par 70, 7,372
 *   shinnecock-hills     2018 US Open card                par 70, 7,440
 *   bandon-dunes         black-tee card                   par 72, 6,732
 *   shadow-creek         championship card                par 72, 7,560
 *   winged-foot-west     2020 US Open card                par 70, 7,477
 *
 * STILL APPROXIMATE, and not from those cards:
 *   - Regular and forward tees, scaled from the championship yardage by each
 *     hole's original ratio.
 *   - Stroke indices, except Bandon Dunes. `normalizeCourses` only guarantees
 *     they form a valid 1-18 allocation, not that they match the real card.
 *   - Course and slope ratings, which still date from the invented yardages.
 *   - All green data - break direction, severity and the slope notes - which
 *     was never sourced and drives only the caddie's putt reading.
 */

import { normalizeCourses } from "./courseIntegrity";

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
  /** Approximate break in inches per 10 ft of putt - 0 = flat, 6+ = severe */
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
  /** Feet above sea level - used for altitude yardage correction */
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

const RAW_COURSE_LIBRARY: GolfCourse[] = [
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
      [5,  2, 585, 560, 520, "left_to_right",  2, "Back green drains right. Pin back-right is treacherous.", "right"],
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
      [5,  1, 545, 525, 485, "right_to_left",  3, "Classic back-nine par 5. Approaches from right center easier.", "left"],
      [4,  7, 440, 420, 390, "left_to_right",  4, "Bunker on left. Green slopes left-to-right and is narrow. Pin right is punishing.", "right"],
      [5, 11, 550, 530, 495, "double_break",   5, "Two-tier. Top tier runs back. Bottom tier runs left. Famous back-nine run starts.", "any"],
      [3,  9, 170, 155, 130, "right_to_left",  3, "Reachable par 3. Green tilts right-to-left. Ball releases hard from right half.", "left"],
      [4, 15, 450, 435, 405, "downhill",        3, "Downhill run to green. Front pin = short is dead. Back left is birdie zone.", "front"],
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
      [5,  7, 516, 500, 475, "downhill",        2, "Downhill second shot. Green wraps around bunker front-left.", "front"],
      [4, 15, 404, 385, 355, "right_to_left",  3, "Famous cliff approach. Never right - ocean. Green tilts left hard.", "left"],
      [4,  9, 331, 315, 295, "relatively_flat", 1, "Short dogleg right. Green is fairly benign. Great birdie chance.", "none"],
      [3, 11, 195, 180, 150, "left_to_right",  3, "Ocean right. Green falls right. Miss left always.", "right"],
      [5,  1, 540, 520, 490, "right_to_left",  2, "Uphill landing zone then right-to-left green from tee level.", "left"],
      [3, 17, 106, 100,  80, "right_to_left",  4, "Shortest hole on course. Ocean hugs left. Green severe left tilt.", "left"],
      [4,  3, 428, 410, 385, "left_to_right",  3, "Elevated tee. Green sits right, slopes away right-to-left from left bunker.", "right"],
      [4, 13, 504, 480, 450, "double_break",   5, "Hardest par 4 on course. Green slopes both ways depending on pin.", "any"],
      [4,  6, 446, 430, 405, "right_to_left",  3, "Back nine opener. Big green tilts from right rough toward ocean.", "left"],
      [4, 14, 390, 375, 350, "relatively_flat", 2, "Drivable par 4 for scratch+. Green gentle front-to-back only.", "back"],
      [3, 18, 202, 185, 160, "left_to_right",  4, "Ocean full right. Never go right. Green pushed toward cliff.", "right"],
      [4, 10, 445, 425, 395, "downhill",        3, "Downhill approach. Green front is false-don't be short.", "false_front"],
      [5,  8, 580, 560, 530, "left_to_right",  2, "Long par 5. Green wide but runs right toward cliff bank.", "right"],
      [4,  4, 397, 375, 350, "uphill",          2, "Uphill finish. Green elevated. Ball feeds back off platform edges.", "front"],
      [4,  2, 403, 385, 360, "right_to_left",  3, "Cliff alongside. Green slopes toward ocean (left).", "left"],
      [3, 16, 178, 160, 140, "relatively_flat", 2, "Bunker-guarded. Green is one of Pebble's flattest.", "none"],
      [5, 12, 543, 525, 500, "double_break",   4, "Finishing par 5. Green double-breaker. Approach from left center ideal.", "any"],
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
      [4,  9, 424, 405, 380, "right_to_left",  3, "Bermuda grain runs toward water left. Pin left is a sucker.", "left"],
      [5, 15, 555, 535, 510, "left_to_right",  2, "Dogleg left off tee. Green slopes right toward water.", "right"],
      [3, 17, 182, 165, 140, "right_to_left",  3, "Green falls toward front-left bunker. Never above pin.", "left"],
      [4,  5, 387, 370, 345, "left_to_right",  2, "Water left. Green pushes away right to false front trap.", "false_front"],
      [4,  1, 469, 450, 425, "right_to_left",  4, "Stroke index 1. Green tilt toward water hazard left.", "left"],
      [4, 11, 413, 375, 325, "uphill",          2, "Uphill green. Ball drifts back off top tier.", "front"],
      [4,  3, 450, 430, 405, "relatively_flat", 2, "One of the flatter greens. Bunkers guard front corners.", "none"],
      [3, 13, 236, 215, 190, "left_to_right",  3, "Short par 4. Green slopes right toward water.", "right"],
      [5,  7, 601, 580, 545, "double_break",   4, "Back nine reachable par 5. Green double-tier - very difficult.", "any"],
      [4, 17, 419, 400, 380, "right_to_left",  3, "Island green hole (17). Entire perimeter is danger. Center or die.", "any"],
      [5, 11, 573, 550, 525, "left_to_right",  2, "Reachable. Green slopes from left rough toward water right.", "right"],
      [4,  7, 365, 350, 330, "downhill",        3, "Downhill. False front collects everything short.", "false_front"],
      [3,  9, 183, 165, 145, "right_to_left",  4, "Large green but severe right-to-left on back half.", "left"],
      [4,  2, 485, 465, 440, "uphill",          2, "Uphill second shot. Green back-right pin is most manageable.", "back"],
      [4, 18, 470, 450, 425, "left_to_right",  3, "Finishing hole. Green slopes right with lake behind.", "right"],
      [5,  5, 537, 515, 485, "right_to_left",  2, "Drivable for long players. Small green, tight right-to-left tilt.", "left"],
      [3, 13, 141, 135, 125, "relatively_flat", 1, "Benign late hole. Green is one of the flattest on course.", "none"],
      [4, 15, 462, 410, 335, "downhill",       3, "Short par 3. Green falls front-left. Never short-right.", "front"],
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
      [4, 14, 376, 360, 335, "relatively_flat", 1, "Famous shared double green with 18. Sweeping left tilt on back half.", "none"],
      [4, 12, 453, 435, 410, "left_to_right",  2, "Blind tee. Elbow dogleg. Green slopes gently right toward whins.", "right"],
      [4, 18, 397, 380, 355, "right_to_left",  2, "Cartgate Out. Short par 4 with wide shallow green.", "left"],
      [4,  8, 480, 465, 440, "relatively_flat", 2, "Gorse right. Wide green is forgiving. Classic St Andrews.", "none"],
      [5, 16, 568, 550, 520, "left_to_right",  3, "Hole o' Cross. Long par 5 with hidden bunkers.", "right"],
      [4,  4, 412, 395, 370, "right_to_left",  3, "Heathery Hole. Narrow approach. Green falls to left bunker.", "left"],
      [4,  6, 371, 355, 330, "relatively_flat", 1, "High Hole. One of the wider greens. Moderate front-to-back only.", "none"],
      [3,  2, 188, 170, 145, "right_to_left",  3, "Short End. Famous Strath bunker. Never go right above hole.", "left"],
      [4, 10, 352, 335, 310, "downhill",        2, "End Hole. Runs down to shared green. False front is real.", "false_front"],
      [4,  3, 386, 370, 345, "left_to_right",  2, "Bobby Jones Hole. Well-bunkered. Slopes away right.", "right"],
      [3, 11, 174, 160, 135, "relatively_flat", 2, "Short Hole. Most benign par 3 on course. Gentle back slope.", "back"],
      [4,  9, 348, 330, 310, "right_to_left",  3, "Heathery Out. Tight green slopes strongly left.", "left"],
      [4,  7, 465, 450, 420, "relatively_flat", 4, "Hole o' Cross (in). Cauldron bunker a nightmare. Green fairly flat.", "none"],
      [5,  5, 618, 600, 565, "left_to_right",  2, "Long Hole. Classic links par 5. Green sweeps gently right.", "right"],
      [4,  1, 455, 435, 415, "right_to_left",  4, "Cartgate In. Stiff two-shotter. Green breaks toward Eden Estuary.", "left"],
      [4, 13, 423, 385, 325, "relatively_flat", 1, "Corner of the Dyke. Flat green - rare treat at St Andrews.", "none"],
      [4, 17, 495, 480, 455, "right_to_left",  3, "Road Hole. Infamous pot bunker. Never above hole - road behind.", "back"],
      [4, 15, 357, 340, 315, "relatively_flat", 1, "Tom Morris Hole. Wide shared green with 1st. Gentle right-to-left.", "left"],
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
      [4,  5, 451, 435, 410, "right_to_left",  3, "Dogleg left. Green tilts toward canyon. Left pin is tight.", "left"],
      [4, 15, 389, 375, 350, "left_to_right",  2, "Two-tiered green. Upper tier runs right. Lower tier holds better.", "right"],
      [3, 11, 201, 185, 160, "relatively_flat", 2, "Ocean views. Green fairly flat. Don't be long.", "back"],
      [4,  7, 490, 470, 445, "right_to_left",  4, "Stroke-index 7. Long two-shotter. Green severely tilted left.", "left"],
      [4,  1, 454, 435, 410, "left_to_right",  3, "Opener. Green complex slopes right. Bunkers both sides.", "right"],
      [5,  3, 564, 545, 515, "downhill",        3, "Downhill into ravine. Don't fly green - it's a cliff.", "back"],
      [4, 13, 462, 445, 420, "right_to_left",  3, "Views of Pacific. Classic fall-left green along canyon.", "left"],
      [3,  9, 177, 170, 160, "uphill",          2, "Uphill into prevailing wind. Green sits elevated. Short is below hole.", "none"],
      [5, 17, 615, 565, 485, "left_to_right",  4, "Difficult par 3 into prevailing westerly. Green slopes hard right.", "right"],
      [4,  8, 454, 435, 415, "right_to_left",  3, "Strong par 4 with barranca right. Green tilts left as always.", "left"],
      [3, 10, 225, 220, 205, "left_to_right",  2, "Birdie hole. Long par 5. Green sweeps gently right.", "right"],
      [4, 16, 505, 455, 385, "relatively_flat", 1, "One of the flatter greens on course.", "none"],
      [5,  4, 621, 595, 565, "right_to_left",  4, "Demanding. Long and tight. Green pulls hard left.", "left"],
      [4, 18, 437, 420, 400, "double_break",   4, "Finishing hole. Famous double-tier green. Below hole always.", "any"],
      [4,  6, 480, 460, 435, "left_to_right",  3, "Canyon left. Green slopes away right - don't over-draw.", "right"],
      [3, 14, 227, 220, 205, "right_to_left",  3, "Consistent left-breaking green with steep back tier.", "left"],
      [4,  2, 443, 425, 395, "relatively_flat", 2, "Fairly forgiving green. Wide and receptive.", "none"],
      [5, 12, 570, 525, 450, "right_to_left",  4, "Long carry over ravine. Green slopes steeply left.", "left"],
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
      [4,  3, 430, 415, 390, "right_to_left",  3, "Green tilts back-right to front-left. Front pin plays tricks.", "left"],
      [4, 13, 389, 375, 350, "left_to_right",  3, "Narrow second shot. Green pushes right.", "right"],
      [3,  9, 230, 210, 180, "relatively_flat", 2, "Long carry. Green is wide and flat - relief on this beast.", "none"],
      [5, 17, 517, 500, 475, "left_to_right",  3, "Birdie chance. Green sweeps right behind bunkers.", "right"],
      [4,  1, 478, 460, 435, "right_to_left",  4, "Stroke-index 1. Brutal opener. Green severe left-tilt.", "left"],
      [4, 11, 408, 395, 375, "downhill",        3, "Longest hole. Green rolls hard downhill front-to-back.", "back"],
      [5,  5, 553, 530, 505, "right_to_left",  4, "Stroke-index 5 for a reason. Another long two-shotter left-breaking.", "left"],
      [3, 15, 210, 190, 165, "left_to_right",  3, "Bunkers surround. Green tilts right - favor left side.", "right"],
      [4,  7, 460, 440, 415, "relatively_flat", 2, "Shorter hole provides some breathing room. Near-flat green.", "none"],
      [4,  2, 502, 485, 455, "right_to_left",  3, "Second nine opener. Familiar left-breaking Bethpage green.", "left"],
      [4, 16, 435, 420, 395, "left_to_right",  3, "Severely bunkered. Green slopes right. Never miss right.", "right"],
      [4,  8, 501, 455, 390, "right_to_left",  4, "Water hazard lurks. Green tilts hard left from right bunker.", "left"],
      [5, 14, 608, 585, 555, "left_to_right",  2, "Generous landing zone. Green opens up from left center.", "right"],
      [3, 18, 161, 155, 145, "downhill",        3, "Stadium finish. Downhill green sweeps toward gallery.", "front"],
      [4,  6, 478, 460, 430, "uphill",          2, "Uphill green. Ball feeds back from back pin easily.", "back"],
      [4, 10, 490, 470, 445, "right_to_left",  3, "Brutish second shot. Green severely tilted.", "left"],
      [3, 12, 207, 200, 190, "left_to_right",  3, "Another long, demanding par 4. Green goes right.", "right"],
      [4,  4, 411, 380, 330, "relatively_flat", 2, "One of Bethpage's more forgiving greens.", "none"],
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
      [5,  5, 608, 580, 550, "right_to_left",  3, "Links-style. Green rolls away left with prevailing wind.", "left"],
      [4, 17, 338, 325, 310, "left_to_right",  2, "Longest hole. Green wide and sweeps gently right.", "right"],
      [4, 11, 508, 465, 395, "relatively_flat", 1, "Wide links par 3. Green is among flattest on course.", "none"],
      [4,  3, 439, 420, 395, "right_to_left",  3, "Rolling terrain. Green tilts away hard left.", "left"],
      [4,  7, 505, 485, 460, "double_break",   4, "Reachable. Two-tier approach green. Very tricky.", "any"],
      [3, 15, 208, 200, 190, "downhill",        3, "Downhill finish. Green releases toward rough back-right.", "back"],
      [5,  9, 607, 550, 475, "left_to_right",  3, "Famous scenic hole. Green falls toward valley right.", "right"],
      [4,  1, 492, 470, 445, "right_to_left",  4, "Stroke-index 1. Long, demanding. Green tilts severely left.", "left"],
      [3, 13, 135, 130, 120, "uphill",          2, "Uphill approach. Green seated on plateau - runs back.", "back"],
      [4,  6, 504, 480, 455, "left_to_right",  3, "Gorse-lined. Green slopes right. Bunker collects left misses.", "right"],
      [4, 18, 460, 445, 420, "right_to_left",  3, "Finishing par 5. Grandstand lines left. Green breaks left.", "left"],
      [4, 16, 464, 425, 370, "right_to_left",  3, "Long carry. Green heavily favors left roll.", "left"],
      [3,  2, 193, 185, 175, "relatively_flat", 2, "Generous fairway. Green is forgiving for Erin Hills.", "none"],
      [5, 10, 594, 570, 535, "left_to_right",  3, "Green slopes away right - favor left of center approach.", "right"],
      [4, 14, 357, 340, 325, "downhill",        2, "Downhill second. Never get behind this pin - rolls forever.", "back"],
      [3, 12, 183, 175, 165, "right_to_left",  3, "Consistent left-break throughout.", "left"],
      [4,  8, 509, 490, 465, "left_to_right",  2, "Accessible par 5. Green sweeps right of center.", "right"],
      [5,  4, 637, 585, 505, "relatively_flat", 1, "Flatter green, nice respite. Bunkers left and right.", "none"],
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
      [4,  9, 422, 405, 380, "left_to_right",  2, "Tree-lined. Green slopes gently right - ocean influence.", "right"],
      [5, 17, 550, 530, 500, "right_to_left",  1, "Birdie hole. Short par 5. Green rolls left.", "left"],
      [4, 15, 469, 425, 365, "relatively_flat", 2, "Short and charming par 3. Flat green rewards patience.", "none"],
      [3,  3, 200, 190, 180, "right_to_left",  4, "Tree-lined fairway. Green falls toward water left.", "left"],
      [5,  7, 569, 545, 515, "left_to_right",  3, "Green slopes away from trees right. Bunker collects left.", "right"],
      [4, 11, 431, 390, 335, "relatively_flat", 2, "One of the flatter par 3s. Water right cautions.", "none"],
      [3,  5, 217, 205, 195, "right_to_left",  3, "Drivable for scratch. Green feeds toward marsh.", "left"],
      [4,  1, 473, 455, 435, "left_to_right",  2, "Opener. Wide fairway. Green sweeps right gently.", "right"],
      [4, 13, 332, 320, 300, "downhill",        3, "Scenic. Green runs downhill past false front.", "false_front"],
      [4,  4, 451, 435, 410, "right_to_left",  4, "Demanding two-shotter. Green breaks toward tidal creek.", "left"],
      [4, 14, 436, 415, 390, "left_to_right",  2, "Shorter hole - tempting to attack. Green tilts right.", "right"],
      [4, 16, 430, 390, 335, "right_to_left",  3, "Water right. Green breaks away from danger - toward left.", "left"],
      [4, 18, 373, 360, 340, "relatively_flat", 1, "Famous lighthouse finish. Tiny peninsula green - every side is trouble.", "any"],
      [3,  6, 192, 185, 175, "right_to_left",  3, "Green falls toward lagoon left.", "left"],
      [5, 10, 588, 535, 465, "left_to_right",  3, "Longer par 3. Green slopes right away from marsh.", "right"],
      [4, 12, 434, 415, 390, "relatively_flat", 2, "Mid-round breather. Flat green, manageable.", "none"],
      [3,  2, 198, 190, 180, "right_to_left",  3, "Tree-lined. Green tilts toward tidal area.", "left"],
      [4, 16, 478, 460, 435, "downhill",        3, "Downhill par 4. Green runs toward pond.", "front"],
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
      [4, 11, 493, 470, 445, "right_to_left",  3, "Bluff-side opener. Green rolls toward Lake Michigan (left).", "left"],
      [5,  7, 597, 575, 545, "left_to_right",  2, "Along the lake. Long approach. Green sweeps right toward fescue.", "right"],
      [3, 13, 188, 170, 145, "relatively_flat", 1, "Short par 3. Green perched on bluff with relatively flat surface.", "none"],
      [4,  3, 494, 475, 450, "right_to_left",  4, "Stroke-index 3. Links-style. Green falls toward lake hard.", "left"],
      [5, 15, 603, 550, 480, "left_to_right",  4, "Long forced carry. Green tilts right toward grass bunker complex.", "right"],
      [4,  1, 409, 395, 370, "right_to_left",  4, "Hardest on card. Green runs away toward bunker complex.", "left"],
      [3,  9, 221, 215, 205, "left_to_right",  3, "Long par 5 along the shore. Green wide and sweeps right.", "right"],
      [4,  5, 506, 485, 455, "relatively_flat", 2, "One of the more forgiving greens on course.", "none"],
      [4, 17, 442, 425, 400, "right_to_left",  3, "Penultimate hole. Green falls toward lake.", "left"],
      [4,  2, 391, 375, 355, "left_to_right",  3, "Back nine opener. Green slopes right toward bunker collection.", "right"],
      [5, 18, 645, 595, 515, "right_to_left",  4, "Famous island-style par 3 finish. Green severely left-breaking.", "left"],
      [3, 12, 163, 155, 150, "downhill",        3, "Downhill. Green rolls toward lake.", "back"],
      [4, 16, 402, 385, 365, "double_break",   5, "Dramatic ridge-green. Double break - choose side carefully.", "any"],
      [4, 10, 396, 380, 360, "right_to_left",  3, "Classic links two-shotter. Green tilts toward fescue.", "left"],
      [4, 14, 503, 480, 450, "left_to_right",  2, "Reachable green for scratch. Sweeps gently right.", "right"],
      [5,  6, 568, 520, 450, "relatively_flat", 2, "Mid-round par 3. Green is fairly flat - enjoyable.", "none"],
      [3,  4, 249, 240, 225, "right_to_left",  4, "Demanding mid-round hole. Falls toward lake.", "left"],
      [4,  8, 520, 500, 470, "left_to_right",  3, "Stiff dogleg. Green pushed right toward steep drop.", "right"],
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
      [4,  5, 461, 440, 415, "left_to_right",  3, "Green tilts right away from sand trap.", "right"],
      [3,  3, 231, 220, 210, "right_to_left",  2, "Long par 5. Green funnels toward left rough.", "left"],
      [4, 11, 434, 395, 340, "relatively_flat", 1, "Lake right. Flat green - rare relief hole.", "none"],
      [5,  1, 590, 565, 535, "right_to_left",  4, "Long demanding opener. Green breaks hard left.", "left"],
      [4,  7, 390, 375, 350, "left_to_right",  3, "Dogleg left. Green falls right toward lake.", "right"],
      [5, 15, 555, 535, 510, "left_to_right",  2, "Reachable par 5. Green sweeps right toward water.", "right"],
      [3,  9, 199, 190, 180, "right_to_left",  4, "Green falls hard toward sand left.", "left"],
      [4, 17, 460, 420, 365, "right_to_left",  4, "Island green par 3 over water. Green slopes steeply left.", "left"],
      [4, 13, 480, 460, 435, "downhill",        3, "Downhill. Green runs toward gallery area below.", "front"],
      [4,  6, 400, 385, 360, "left_to_right",  3, "Green pushed right by mounding.", "right"],
      [4, 11, 438, 420, 400, "right_to_left",  2, "Birdie hole. Green funnels left of center.", "left"],
      [5, 15, 574, 525, 440, "relatively_flat", 2, "Short par 3. Near-flat surface.", "none"],
      [4,  2, 382, 365, 345, "right_to_left",  3, "Classic Bay Hill two-shotter. Green breaks left.", "left"],
      [3, 18, 215, 205, 195, "downhill",        3, "Finishing hole over lake. Green downhill - don't go long.", "back"],
      [4,  4, 467, 450, 425, "right_to_left",  4, "Long and demanding. Green tilts severely left.", "left"],
      [5, 12, 511, 490, 465, "left_to_right",  3, "Green slopes away right toward hazard.", "right"],
      [3,  8, 221, 215, 200, "left_to_right",  2, "Bombers' hole. Wide green sweeps right.", "right"],
      [4, 16, 458, 440, 410, "relatively_flat", 1, "Most forgiving green in the stretch.", "none"],
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
      [4,  5, 396, 380, 355, "left_to_right",  3, "Ocean right. Green pushed hard right by prevailing sea breeze.", "right"],
      [5,  1, 557, 535, 510, "right_to_left",  2, "Atlantic views. Green feeds left toward rough.", "left"],
      [4, 13, 390, 355, 305, "relatively_flat", 2, "One of the few forgiving holes. Green is fairly flat.", "none"],
      [4,  9, 484, 465, 440, "right_to_left",  4, "Stroke-index 9 but it's brutal. Ocean wind makes approach tough.", "left"],
      [3,  3, 207, 200, 190, "left_to_right",  3, "Green pushed by sea right. Bunker collects short left.", "right"],
      [4, 11, 490, 470, 445, "left_to_right",  2, "Risk-reward par 5. Green sweeps right toward water.", "right"],
      [5, 17, 579, 530, 465, "right_to_left",  5, "Famous. Ocean left. Green severely tilted left - worst putt on course.", "left"],
      [3,  7, 198, 190, 180, "right_to_left",  4, "Long and exposed. Green breaks left toward ocean.", "left"],
      [4, 15, 514, 490, 465, "left_to_right",  3, "Green swept right by consistent afternoon breeze.", "right"],
      [4,  6, 447, 430, 405, "right_to_left",  3, "Back nine. Green tilts left consistently.", "left"],
      [5, 16, 593, 570, 545, "double_break",   5, "Wild double-tier - break varies by half. Read carefully.", "any"],
      [4, 10, 484, 445, 385, "left_to_right",  4, "All-or-nothing par 3. Green hard right - bail-out is ocean.", "right"],
      [4,  2, 497, 480, 450, "right_to_left",  4, "Strong wind hole. Green severely left-breaking.", "left"],
      [3, 14, 238, 230, 215, "downhill",        3, "Downhill approach. Green runs toward dunes.", "back"],
      [4,  8, 466, 445, 420, "left_to_right",  3, "Green opens up from left center.", "right"],
      [5, 18, 608, 580, 550, "right_to_left",  4, "Stadium finish. Crowd and ocean breeze both push left.", "left"],
      [3, 12, 223, 215, 205, "left_to_right",  2, "Long and exposed. Green sweeps right in afternoon sun.", "right"],
      [4,  4, 505, 460, 395, "relatively_flat", 2, "Mid-front nine par 3. Green is relatively forgiving.", "none"],
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
      [4,  9, 490, 470, 445, "right_to_left",  3, "Stream guards front. Green tilts left toward water.", "left"],
      [4,  7, 459, 445, 420, "left_to_right",  2, "Reachable. Green sweeps gently right.", "right"],
      [4, 15, 392, 355, 310, "relatively_flat", 2, "Flat green is a gift in this demanding layout.", "none"],
      [3,  1, 210, 200, 190, "right_to_left",  4, "Stroke-index 1. Creek at rear. Green breaks steeply left.", "left"],
      [5,  3, 547, 525, 495, "left_to_right",  3, "Well-bunkered. Green pushes right toward stream.", "right"],
      [4, 11, 455, 440, 415, "right_to_left",  1, "Birdie chance. Green tilts left.", "left"],
      [5, 17, 582, 560, 525, "downhill",        3, "Downhill approach. Green sweeps toward stream below.", "front"],
      [3,  9, 200, 180, 155, "right_to_left",  3, "Short par 3. Creek behind. Green falls toward front-left.", "left"],
      [4,  5, 417, 400, 375, "left_to_right",  2, "Dogleg right. Green opens up from left center approach.", "right"],
      [4, 13, 472, 455, 430, "right_to_left",  3, "Tough stretch hole. Green consistently breaks left.", "left"],
      [5, 11, 588, 565, 535, "left_to_right",  4, "Long, demanding mid-round hole. Green sweeps right.", "right"],
      [3,  7, 180, 165, 140, "relatively_flat", 2, "Near-flat green on par 3.", "none"],
      [4, 15, 455, 440, 415, "right_to_left",  2, "Classic Nicklaus par 5. Green breaks left at end.", "left"],
      [4, 18, 360, 345, 325, "downhill",        4, "Grandstand finish. Downhill green - don't go long.", "back"],
      [5,  6, 561, 540, 510, "right_to_left",  3, "Wooded backdrop. Green tilts toward creek.", "left"],
      [3, 16, 218, 210, 200, "left_to_right",  3, "Back nine two-shotter. Green slopes right.", "right"],
      [4,  2, 503, 480, 450, "right_to_left",  3, "Creek in play from tee. Green breaks toward stream.", "left"],
      [4, 14, 480, 460, 430, "relatively_flat", 1, "Short par 4. Green is the flattest on course.", "none"],
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
      [5,  7, 503, 485, 460, "right_to_left",  4, "Long par 4. Green breaks toward native left rough.", "left"],
      [4,  3, 471, 455, 430, "left_to_right",  3, "Classic Riviera. Green tilts away from bunkers right.", "right"],
      [4, 13, 434, 400, 345, "relatively_flat", 1, "One of course's flatter greens.", "none"],
      [3,  5, 273, 260, 245, "right_to_left",  3, "Bunker-guarded. Green falls toward native area left.", "left"],
      [4,  1, 434, 420, 400, "left_to_right",  2, "Par 5 opener. Long. Green sweeps right.", "right"],
      [3, 15, 199, 180, 155, "right_to_left",  3, "Bunker island green. Green tilts hard left.", "left"],
      [4,  9, 408, 390, 370, "downhill",        3, "Downhill. Eucalyptus trees frame approach. Green runs forward.", "false_front"],
      [4, 17, 433, 415, 395, "right_to_left",  4, "Classic Riviera par 4 - severely left-breaking green.", "left"],
      [4, 11, 458, 440, 415, "left_to_right",  3, "Another demanding two-shotter. Green falls right.", "right"],
      [4,  2, 315, 300, 285, "right_to_left",  4, "Stroke-index 2. Tight and tough. Green breaks left.", "left"],
      [5, 18, 583, 560, 530, "left_to_right",  3, "Drivable par 5 for big hitters. Green slopes right.", "right"],
      [4,  6, 479, 435, 375, "right_to_left",  3, "Par 3 over canyon. Green tilts left.", "left"],
      [4, 16, 459, 440, 415, "right_to_left",  3, "Classic Riviera two-shotter. Left-breaking green.", "left"],
      [3, 14, 192, 185, 175, "left_to_right",  2, "Bunkers left. Green sweeps right toward native rough.", "right"],
      [4,  4, 487, 465, 440, "right_to_left",  3, "Tree-lined. Green breaks toward garden left.", "left"],
      [3, 10, 166, 155, 145, "relatively_flat", 1, "Short par 4. Most forgiving green on course.", "none"],
      [5,  8, 590, 570, 540, "double_break",   4, "Long par 5 - double-tier green is very tricky.", "any"],
      [4, 12, 499, 480, 450, "left_to_right",  2, "Short two-shotter. Green pushed right.", "right"],
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
      [4,  3, 488, 470, 445, "right_to_left",  4, "Church Pew bunkers. Green severely tilted left - fastest on course.", "left"],
      [4, 11, 346, 330, 305, "left_to_right",  2, "Short but treacherous. Green tilts right toward rough.", "right"],
      [4, 15, 462, 420, 360, "relatively_flat", 1, "Oakmont's flattest green - still very fast.", "none"],
      [5,  9, 611, 590, 560, "right_to_left",  2, "Long par 5. Green breaks left on back half.", "left"],
      [4,  1, 408, 390, 370, "left_to_right",  3, "Green tilts right toward rough. Never above this hole.", "right"],
      [3,  5, 200, 190, 180, "right_to_left",  4, "Tiny green. Any miss is brutal. Severe left-tilt.", "left"],
      [4, 13, 485, 445, 385, "right_to_left",  3, "All three-spots are dangerous here. Left-tilt green.", "left"],
      [3,  7, 289, 280, 260, "left_to_right",  3, "Church Pew hole. Green pushed far right - be exact.", "right"],
      [4,  9, 472, 455, 430, "right_to_left",  4, "Closing front nine. Another left-breaking nightmare.", "left"],
      [4,  6, 461, 440, 415, "relatively_flat", 2, "One of the few manageable greens at Oakmont.", "none"],
      [4, 17, 400, 385, 370, "double_break",   5, "Longest hole in USGA competition. Double-break green.", "any"],
      [5,  8, 632, 585, 520, "left_to_right",  4, "Long par 3. Green tilts right - very fast.", "right"],
      [3, 18, 182, 175, 165, "right_to_left",  3, "Finishing hole. Green falls back left. Don't be above hole.", "left"],
      [4, 16, 379, 365, 345, "left_to_right",  3, "Green consistently slopes right on back nine.", "right"],
      [4,  4, 507, 485, 460, "right_to_left",  3, "Bunker-framed. Green tilts left toward sand complex.", "left"],
      [3, 14, 236, 225, 210, "relatively_flat", 2, "Short par 4. Green still very fast but fairly flat.", "none"],
      [4, 12, 312, 300, 285, "right_to_left",  3, "Unusually long par 4 at times. Green breaks left as expected.", "left"],
      [4, 10, 502, 460, 400, "right_to_left",  4, "Par 3 on back nine. Very fast left-breaking surface.", "left"],
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
      [4,  5, 399, 385, 360, "right_to_left",  3, "Links-style. Green falls toward ocean (left).", "left"],
      [3,  3, 252, 245, 230, "left_to_right",  2, "Exposed. Green sweeps right with prevailing wind.", "right"],
      [4, 13, 500, 455, 390, "relatively_flat", 1, "Flat green by Shinnecock standards. Take the par and go.", "none"],
      [4,  1, 475, 455, 430, "right_to_left",  4, "Classic opener. Green tilts toward ocean west of fairway.", "left"],
      [5,  7, 589, 565, 535, "left_to_right",  3, "Exposed plateau green. Pushes right in the wind.", "right"],
      [4, 15, 491, 470, 445, "right_to_left",  2, "Short par 5. Green breaks left. Aggressive play earns eagles.", "left"],
      [3, 11, 189, 175, 150, "right_to_left",  5, "Long forced carry. Famous severe left-breaking green.", "left"],
      [4,  9, 439, 420, 400, "left_to_right",  3, "Exposed plateau. Green sweeps right toward Atlantic.", "right"],
      [4, 17, 485, 465, 440, "relatively_flat", 2, "Wind-battered but flatter green than most.", "none"],
      [4,  2, 415, 400, 375, "right_to_left",  3, "Windswept. Green falls toward estuary.", "left"],
      [3, 18, 159, 155, 145, "left_to_right",  3, "Bunker right. Green slopes right toward clubhouse.", "right"],
      [4,  6, 469, 430, 375, "right_to_left",  4, "Long carry. Wind usually in face. Green tilts left.", "left"],
      [4, 16, 374, 360, 340, "left_to_right",  3, "Green pushed right by slope.", "right"],
      [4, 14, 519, 500, 470, "right_to_left",  3, "Back nine par 4. Green consistently breaks left.", "left"],
      [4,  8, 409, 395, 375, "double_break",   4, "Complex par 5. Two-tier green in the breeze.", "any"],
      [5, 12, 616, 590, 560, "right_to_left",  3, "Classic links two-shotter. Green falls left.", "left"],
      [3,  4, 175, 165, 155, "relatively_flat", 2, "Shorter hole in the mix. Green is forgiving.", "none"],
      [4, 10, 485, 465, 435, "left_to_right",  2, "Opening back nine. Green slopes right toward rough.", "right"],
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
      [4, 13, 386, 370, 345, "left_to_right",  3, "Links opener. Green pushed by Pacific sea breeze.", "right"],
      [3, 15, 189, 180, 175, "right_to_left",  1, "Birdie chance. Green funnels left.", "left"],
      [5,  3, 543, 495, 425, "relatively_flat", 2, "Flat links par 3. Wind the factor, not slope.", "none"],
      [4,  5, 410, 395, 370, "right_to_left",  4, "Ocean-side. Green falls toward Pacific.", "left"],
      [4,  1, 428, 410, 385, "left_to_right",  3, "Green pushed oceanward (right).", "right"],
      [3, 17, 161, 155, 145, "left_to_right",  2, "Exposed par 5. Green sweeps right with wind.", "right"],
      [4,  7, 383, 350, 300, "right_to_left",  4, "Famous cliff-side par 3. Green tilts left hard.", "left"],
      [4, 11, 359, 345, 325, "right_to_left",  4, "Stroke index 1. Demanding start. Green falls oceanward.", "left"],
      [5,  9, 558, 535, 505, "downhill",        3, "Downhill ocean views. Green runs off back hard.", "back"],
      [4,  8, 362, 345, 325, "left_to_right",  3, "Consistent right-sweeping green.", "right"],
      [4,  2, 384, 370, 345, "right_to_left",  3, "Finishing hole into prevailing wind. Green breaks left.", "left"],
      [3, 18, 199, 180, 155, "relatively_flat", 1, "Short par 3. Near-flat green.", "none"],
      [5,  6, 553, 530, 500, "right_to_left",  3, "Classic links par 4. Green tilts oceanward.", "left"],
      [4, 16, 359, 345, 325, "left_to_right",  2, "Green opened up from left-center. Sweeps right.", "right"],
      [3, 14, 163, 155, 150, "left_to_right",  2, "Reachable with wind. Green feeds right.", "right"],
      [4, 10, 363, 350, 330, "right_to_left",  3, "Back nine classic. Green falls left.", "left"],
      [4, 12, 389, 370, 350, "relatively_flat", 2, "Mid-round breather. Green is fairly flat.", "none"],
      [5,  4, 543, 520, 490, "right_to_left",  3, "Clifftop views. Green tilts toward sea.", "left"],
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
      [4,  5, 415, 400, 375, "right_to_left",  3, "Creek runs alongside. Green tilts toward water left.", "left"],
      [4,  3, 435, 420, 400, "left_to_right",  1, "Birdie opportunity. Green sweeps right toward bunkers.", "right"],
      [4, 13, 486, 445, 380, "relatively_flat", 2, "Waterfall nearby but green is fairly flat.", "none"],
      [5,  1, 581, 560, 530, "right_to_left",  4, "Famous opener. Green falls toward creek left.", "left"],
      [3,  7, 202, 195, 185, "left_to_right",  3, "Manicured fairway. Green sweeps right toward grassy bank.", "right"],
      [4, 11, 507, 490, 465, "right_to_left",  2, "Reachable. Green funnels left.", "left"],
      [5, 17, 571, 520, 445, "right_to_left",  3, "Par 3 across water. Green tilts left.", "left"],
      [3,  9, 200, 190, 180, "left_to_right",  3, "Green pushed right by land contour.", "right"],
      [4, 15, 460, 440, 415, "right_to_left",  4, "Demanding back nine. Green breaks hard left.", "left"],
      [4,  6, 437, 420, 395, "left_to_right",  3, "Desert backdrop. Green slopes right.", "right"],
      [4, 18, 324, 310, 295, "downhill",        3, "Dramatic finish through trees. Downhill green runs toward creek.", "front"],
      [4,  4, 405, 370, 320, "relatively_flat", 2, "Mid-round par 3. Near-flat green.", "none"],
      [3, 12, 257, 245, 235, "left_to_right",  2, "Lush par 5. Green widens right.", "right"],
      [4, 16, 493, 475, 450, "right_to_left",  3, "Green falls toward water feature left.", "left"],
      [4,  8, 482, 460, 435, "relatively_flat", 2, "Shorter hole. Green is one of course's most forgiving.", "none"],
      [5,  2, 622, 595, 565, "right_to_left",  3, "Elevated tee. Green tilts toward creek.", "left"],
      [3, 10, 154, 150, 140, "left_to_right",  3, "Back nine opener. Green slopes right.", "right"],
      [5, 14, 529, 505, 475, "right_to_left",  1, "Shortest par 4. Green still breaks left.", "left"],
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
      [4,  5, 451, 435, 410, "right_to_left",  3, "Classic A.W. Tillinghast. Green tilts left toward rough.", "left"],
      [4,  3, 484, 465, 440, "left_to_right",  1, "Short par 5. Green sweeps right toward bunker.", "right"],
      [3, 13, 243, 225, 195, "relatively_flat", 2, "Short par 3. Green is relatively flat.", "none"],
      [4,  1, 467, 450, 425, "right_to_left",  4, "Stroke index 1. Long, demanding. Green falls left.", "left"],
      [5,  9, 502, 485, 460, "right_to_left",  4, "One of the longest par 4s in major history. Green breaks hard left.", "left"],
      [4,  7, 321, 290, 245, "left_to_right",  1, "Shortest hole on course. Par 3. Near-flat but treacherous bunkers.", "none"],
      [3, 15, 162, 155, 145, "left_to_right",  3, "Green pushed right away from trees.", "right"],
      [4,  3, 490, 470, 445, "right_to_left",  3, "Bunker complex surrounds. Green tilts left consistently.", "left"],
      [4, 11, 565, 540, 510, "relatively_flat", 2, "Shorter hole. Green is more forgiving.", "none"],
      [3,  2, 214, 205, 195, "right_to_left",  3, "Back nine opener. Green breaks hard left.", "left"],
      [4, 17, 384, 370, 350, "right_to_left",  4, "Monster par 4. Green consistently falls left.", "left"],
      [5,  9, 633, 580, 500, "right_to_left",  3, "Par 3 over hill. Green tilts left to rough.", "left"],
      [3, 18, 212, 205, 190, "downhill",        3, "Famous 18th. Downhill, then uphill. Grandstand left. Green rolls away.", "front"],
      [4, 16, 452, 435, 410, "left_to_right",  3, "Back nine. Green sweeps right.", "right"],
      [4,  6, 426, 405, 375, "relatively_flat", 1, "Short par 4. Drivable for pros. Green flat.", "none"],
      [4, 14, 498, 475, 450, "right_to_left",  3, "Classic stretch. Green breaks toward left rough.", "left"],
      [4, 12, 504, 480, 455, "left_to_right",  2, "Green widens right. Bunker left collects misses.", "right"],
      [4, 10, 469, 450, 425, "right_to_left",  3, "Consistent left-break throughout back nine.", "left"],
    ]),
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * The course library, with detectable data-entry errors repaired.
 *
 * See convex/lib/courseIntegrity.ts: six courses allocated duplicate stroke
 * indices and three had holes whose par contradicted their own yardage.
 * Repairing at the boundary means every consumer - caddie, scorecard,
 * handicap - sees self-consistent data.
 */
export const COURSE_LIBRARY: GolfCourse[] = normalizeCourses(RAW_COURSE_LIBRARY);

/** Unrepaired data, for the integrity test to assert against. */
export { RAW_COURSE_LIBRARY };

/**
 * The matcher, over any list of courses.
 *
 * Split out from `searchCourses` so the golfer's own courses are searched by
 * exactly the same rule as the built-in ones - a course picker that finds
 * "Pebble" in one list but not the other is worse than no search at all.
 */
export function filterCourses(courses: GolfCourse[], query: string): GolfCourse[] {
  const q = query.toLowerCase().trim();
  if (!q) return courses;
  return courses.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q) ||
      c.id.includes(q)
  );
}

export function searchCourses(query: string): GolfCourse[] {
  return filterCourses(COURSE_LIBRARY, query);
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
    uphill:            "plays uphill - expect putts to be slower",
    downhill:          "runs downhill - putts are fast, be cautious coming back",
    severe_left:       "breaks severely left",
    severe_right:      "breaks severely right",
    double_break:      "has a double break - read each putt carefully",
    relatively_flat:   "is relatively flat with minimal break",
  };
  const sevMap = (sev: number) => {
    if (sev === 0) return "minimal";
    if (sev <= 1) return "subtle";
    if (sev <= 3) return "moderate";
    if (sev <= 5) return "significant";
    return "severe";
  };
  return `${dirMap[green.breakDirection]} (${sevMap(green.breakSeverityInches)} - ~${green.breakSeverityInches}" per 10 ft). ${green.slopeNote}`;
}
