const dom = {
  matchTypeInput: document.getElementById("matchTypeInput"),
  matchTitleInput: document.getElementById("matchTitleInput"),
  matchVenueInput: document.getElementById("matchVenueInput"),
  matchTimeInput: document.getElementById("matchTimeInput"),
  matchTypeDisplay: document.getElementById("matchTypeDisplay"),
  matchTitleDisplay: document.getElementById("matchTitleDisplay"),
  matchVenueDisplay: document.getElementById("matchVenueDisplay"),
  matchTimeDisplay: document.getElementById("matchTimeDisplay"),
  oversInput: document.getElementById("oversInput"),
  targetInput: document.getElementById("targetInput"),
  chasingToggle: document.getElementById("chasingToggle"),
  battingTeamInput: document.getElementById("battingTeamInput"),
  bowlingTeamInput: document.getElementById("bowlingTeamInput"),
  battingTeamName: document.getElementById("battingTeamName"),
  bowlingTeamName: document.getElementById("bowlingTeamName"),
  scoreRuns: document.getElementById("scoreRuns"),
  scoreWickets: document.getElementById("scoreWickets"),
  scoreOvers: document.getElementById("scoreOvers"),
  currentRunRate: document.getElementById("currentRunRate"),
  projectedScore: document.getElementById("projectedScore"),
  requiredRunRate: document.getElementById("requiredRunRate"),
  requiredRateMetric: document.getElementById("requiredRateMetric"),
  oversRemainingDisplay: document.getElementById("oversRemainingDisplay"),
  inningsProgressLabel: document.getElementById("inningsProgressLabel"),
  targetRunsDisplay: document.getElementById("targetRunsDisplay"),
  targetCard: document.getElementById("targetCard"),
  partnershipDisplay: document.getElementById("partnershipDisplay"),
  powerplayDisplay: document.getElementById("powerplayDisplay"),
  lastBallsTrack: document.getElementById("lastBallsTrack"),
  battingTableBody: document.getElementById("battingTableBody"),
  projectedFinishDisplay: document.getElementById("projectedFinishDisplay"),
  extrasDisplay: document.getElementById("extrasDisplay"),
  fowDisplay: document.getElementById("fowDisplay"),
  requiredRunsDisplay: document.getElementById("requiredRunsDisplay"),
  ballsLeftDisplay: document.getElementById("ballsLeftDisplay"),
  currentOverSummary: document.getElementById("currentOverSummary"),
  runSparkline: document.getElementById("runSparkline"),
  strikerInput: document.getElementById("strikerInput"),
  nonStrikerInput: document.getElementById("nonStrikerInput"),
  updateBattersBtn: document.getElementById("updateBattersBtn"),
  runButtons: document.querySelectorAll(".btn.run"),
  extraButtons: document.querySelectorAll(".btn.extra"),
  wicketBtn: document.getElementById("wicketBtn"),
  swapStrikeBtn: document.getElementById("swapStrikeBtn"),
  undoBtn: document.getElementById("undoBtn"),
  resetBtn: document.getElementById("resetBtn"),
  toast: document.getElementById("newBatterToast"),
  liveStatus: document.getElementById("liveStatus"),
};

const MAX_UNDO = 40;

const initialState = () => ({
  oversLimit: Number(dom.oversInput.value) || 20,
  target: Number(dom.targetInput.value) || 0,
  chasing: dom.chasingToggle.checked,
  runs: 0,
  wickets: 0,
  ballsBowled: 0,
  extras: {
    wide: 0,
    noBall: 0,
    bye: 0,
    legBye: 0,
    penalty: 0,
  },
  fallOfWickets: [],
  lastBalls: [],
  currentOverBalls: [],
  overHistory: [],
  partnership: {
    runs: 0,
    balls: 0,
  },
  powerplay: {
    runs: 0,
    wickets: 0,
    balls: 0,
  },
  batters: [
    {
      name: dom.strikerInput.value.trim() || "Batter 1",
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      status: "not out",
      strike: true,
    },
    {
      name: dom.nonStrikerInput.value.trim() || "Batter 2",
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      status: "not out",
      strike: false,
    },
  ],
});

let state = initialState();
const undoStack = [];

function pushUndo() {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}

function restoreState(snapshot) {
  state = JSON.parse(snapshot);
  renderAll();
}

function formatOvers(balls) {
  const overs = Math.floor(balls / 6);
  const ballsPart = balls % 6;
  return `${overs}.${ballsPart}`;
}

function showToast(message) {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.classList.remove("hidden");
  dom.toast.classList.add("visible");
  if (dom.toast.hideTimeout) clearTimeout(dom.toast.hideTimeout);
  dom.toast.hideTimeout = setTimeout(() => {
    dom.toast.classList.remove("visible");
    setTimeout(() => dom.toast.classList.add("hidden"), 350);
  }, 2200);
}

function canDeliverBall() {
  return state.ballsBowled < state.oversLimit * 6 && state.wickets < 10;
}

function getStriker() {
  return state.batters.find((batter) => batter.status === "not out" && batter.strike);
}

function getNonStriker() {
  return state.batters.find((batter) => batter.status === "not out" && !batter.strike);
}

function swapStrikeInternal() {
  const striker = getStriker();
  const nonStriker = getNonStriker();
  if (striker) striker.strike = false;
  if (nonStriker) nonStriker.strike = true;
}

function registerBallEvent(event) {
  const { label, runs, isBoundary, isWicket, ballCounts } = event;
  state.lastBalls.push({ label, isBoundary, isWicket });
  if (state.lastBalls.length > 6) state.lastBalls.shift();
  state.currentOverBalls.push({ label, runs, ballCounts });
}

function updatePowerplay(ballBefore, runsAdded, wicketOccurred, ballCounts) {
  if (ballBefore >= 36) return;
  const remainingBalls = 36 - ballBefore;
  state.powerplay.runs += runsAdded;
  if (wicketOccurred) state.powerplay.wickets += 1;
  if (ballCounts) state.powerplay.balls += Math.min(1, remainingBalls);
}

function finalizeDelivery(ballCounts, strikeChanged) {
  if (ballCounts) {
    state.ballsBowled += 1;
    const overComplete = state.ballsBowled > 0 && state.ballsBowled % 6 === 0;
    if (overComplete) {
      const overRuns = state.currentOverBalls.reduce((sum, entry) => sum + entry.runs, 0);
      state.overHistory.push(overRuns);
      state.currentOverBalls = [];
      if (!strikeChanged && state.wickets < 10) swapStrikeInternal();
    }
  }
}

function introduceNewBatter() {
  if (state.wickets >= 10) return;
  const proposedName = `Batter ${state.batters.length + 1}`;
  const name = window.prompt("New batter to the crease:", proposedName) || proposedName;
  const trimmed = name.trim() || proposedName;
  const newBatter = {
    name: trimmed,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    status: "not out",
    strike: true,
  };
  state.batters.push(newBatter);
  state.batters
    .filter((batter) => batter.status === "not out" && batter !== newBatter)
    .forEach((batter) => {
      batter.strike = false;
    });
  showToast(`${trimmed} joins the crease`);
}

function handleRunButton(event) {
  if (!canDeliverBall()) {
    showToast("Innings complete");
    return;
  }
  const runs = Number(event.currentTarget.dataset.runs);
  const striker = getStriker();
  if (!striker) {
    showToast("Assign active batters first");
    return;
  }
  pushUndo();
  const ballBefore = state.ballsBowled;
  state.runs += runs;
  striker.runs += runs;
  striker.balls += 1;
  state.partnership.runs += runs;
  state.partnership.balls += 1;
  if (runs === 4) striker.fours += 1;
  if (runs === 6) striker.sixes += 1;
  updatePowerplay(ballBefore, runs, false, true);
  const strikeChanged = runs % 2 === 1;
  registerBallEvent({
    label: runs === 0 ? "•" : `${runs}`,
    runs,
    isBoundary: runs === 4 || runs === 6,
    isWicket: false,
    ballCounts: true,
  });
  if (strikeChanged) swapStrikeInternal();
  finalizeDelivery(true, strikeChanged);
  renderAll();
}

function handleExtraButton(event) {
  if (!canDeliverBall()) {
    showToast("Innings complete");
    return;
  }
  const type = event.currentTarget.dataset.extra;
  const striker = getStriker();
  pushUndo();
  const ballBefore = state.ballsBowled;
  const runsAdded = type === "penalty" ? 5 : 1;
  state.runs += runsAdded;
  state.extras[type] += runsAdded === 5 ? 5 : 1;
  let ballCounts = true;
  let label = "";
  let strikeChanged = false;
  switch (type) {
    case "wide":
      label = "Wd";
      ballCounts = false;
      break;
    case "noBall":
      label = "Nb";
      ballCounts = false;
      if (striker) striker.balls += 0;
      break;
    case "bye":
      label = "B1";
      if (striker) striker.balls += 1;
      state.partnership.runs += runsAdded;
      state.partnership.balls += 1;
      strikeChanged = true;
      break;
    case "legBye":
      label = "Lb1";
      if (striker) striker.balls += 1;
      state.partnership.runs += runsAdded;
      state.partnership.balls += 1;
      strikeChanged = true;
      break;
    default:
      label = "+5";
      ballCounts = false;
  }
  updatePowerplay(ballBefore, runsAdded, false, ballCounts);
  registerBallEvent({
    label,
    runs: runsAdded,
    isBoundary: false,
    isWicket: false,
    ballCounts,
  });
  if (strikeChanged) swapStrikeInternal();
  finalizeDelivery(ballCounts, strikeChanged);
  renderAll();
}

function handleWicket() {
  if (!canDeliverBall()) {
    showToast("Innings complete");
    return;
  }
  const striker = getStriker();
  if (!striker) {
    showToast("Assign active batters first");
    return;
  }
  pushUndo();
  const ballBefore = state.ballsBowled;
  const overBefore = formatOvers(state.ballsBowled);
  striker.status = "out";
  striker.strike = false;
  striker.balls += 1;
  state.partnership.balls += 1;
  state.wickets += 1;
  state.fallOfWickets.push(`${state.runs}/${state.wickets} (${striker.name}, ${overBefore})`);
  updatePowerplay(ballBefore, 0, true, true);
  registerBallEvent({
    label: "W",
    runs: 0,
    isBoundary: false,
    isWicket: true,
    ballCounts: true,
  });
  finalizeDelivery(true, false);
  state.partnership = { runs: 0, balls: 0 };
  if (state.wickets < 10) introduceNewBatter();
  renderAll();
}

function handleSwapStrike(manual = true) {
  const striker = getStriker();
  const nonStriker = getNonStriker();
  if (!striker || !nonStriker) {
    if (manual) showToast("Two active batters required");
    return;
  }
  if (manual) pushUndo();
  if (striker) striker.strike = false;
  if (nonStriker) nonStriker.strike = true;
  renderAll();
}

function handleUndo() {
  const snapshot = undoStack.pop();
  if (!snapshot) {
    showToast("Nothing to undo");
    return;
  }
  restoreState(snapshot);
}

function handleReset() {
  pushUndo();
  state = initialState();
  renderAll();
  showToast("Innings reset");
}

function handleUpdateBatters() {
  const striker = getStriker();
  const nonStriker = getNonStriker();
  pushUndo();
  if (striker) striker.name = dom.strikerInput.value.trim() || striker.name;
  if (nonStriker) nonStriker.name = dom.nonStrikerInput.value.trim() || nonStriker.name;
  renderAll();
  showToast("Batters updated");
}

function formatPartnership() {
  const runs = state.partnership.runs;
  const balls = state.partnership.balls;
  return `${runs} (${balls})`;
}

function updateLastBalls() {
  dom.lastBallsTrack.innerHTML = "";
  const placeholders = 6 - state.lastBalls.length;
  for (let i = 0; i < placeholders; i++) {
    const span = document.createElement("span");
    span.className = "ball empty";
    span.textContent = "•";
    dom.lastBallsTrack.appendChild(span);
  }
  state.lastBalls.forEach((item) => {
    const span = document.createElement("span");
    span.className = "ball";
    if (item.isBoundary) span.classList.add("highlight");
    if (item.isWicket) span.classList.add("wicket");
    span.textContent = item.label;
    dom.lastBallsTrack.appendChild(span);
  });
}

function renderBattingTable() {
  dom.battingTableBody.innerHTML = "";
  state.batters.forEach((batter) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${batter.name}${batter.strike && batter.status === "not out" ? " •" : ""}</td>
      <td>${batter.runs}</td>
      <td>${batter.balls}</td>
      <td>${batter.fours}</td>
      <td>${batter.sixes}</td>
      <td>${batter.balls ? ((batter.runs / batter.balls) * 100).toFixed(1) : "0.0"}</td>
      <td>${batter.status === "not out" ? "not out" : "out"}</td>
    `;
    dom.battingTableBody.appendChild(row);
  });
}

function renderSparkline() {
  dom.runSparkline.innerHTML = "";
  const data = state.overHistory.slice(-6);
  if (!data.length) {
    return;
  }
  const max = Math.max(...data, 1);
  data.forEach((runs) => {
    const span = document.createElement("span");
    const height = Math.max(8, (runs / max) * 38);
    span.style.height = `${height}px`;
    dom.runSparkline.appendChild(span);
  });
}

function renderCurrentOverSummary() {
  if (!state.currentOverBalls.length) {
    dom.currentOverSummary.textContent = "—";
    return;
  }
  dom.currentOverSummary.textContent = state.currentOverBalls
    .map((entry) => entry.label)
    .join("  ");
}

function renderExtras() {
  const { wide, noBall, bye, legBye, penalty } = state.extras;
  const total = wide + noBall + bye + legBye + penalty;
  dom.extrasDisplay.textContent = `${total} (${bye}b, ${legBye}lb, ${noBall}nb, ${wide}wd, ${penalty}p)`;
}

function renderFallOfWickets() {
  dom.fowDisplay.textContent = state.fallOfWickets.length ? state.fallOfWickets.join(", ") : "—";
}

function renderAnalytics() {
  const oversBowled = state.ballsBowled / 6;
  dom.scoreOvers.textContent = formatOvers(state.ballsBowled);
  dom.currentRunRate.textContent = oversBowled ? (state.runs / oversBowled).toFixed(2) : "0.00";
  dom.projectedScore.textContent = oversBowled
    ? Math.round((state.runs / oversBowled) * state.oversLimit).toString()
    : "0";
  dom.partnershipDisplay.textContent = formatPartnership();
  const { runs, balls, wickets } = state.powerplay;
  const overs = balls ? (balls / 6).toFixed(1) : "0.0";
  dom.powerplayDisplay.textContent = `${runs}/${wickets} (${overs})`;
  dom.projectedFinishDisplay.textContent = `${state.runs}/${state.wickets} in ${formatOvers(
    state.ballsBowled
  )}`;
  const ballsLeft = state.oversLimit * 6 - state.ballsBowled;
  dom.ballsLeftDisplay.textContent = ballsLeft;
  dom.oversRemainingDisplay.textContent = `${formatOvers(Math.max(ballsLeft, 0))} overs left`;
  const requiredRuns = state.target - state.runs;
  const showRequired = state.chasing && state.target > 0;
  dom.requiredRateMetric.style.display = showRequired ? "grid" : "none";
  dom.requiredRunsDisplay.textContent = showRequired && requiredRuns > 0 ? requiredRuns : "—";
  dom.requiredRunRate.textContent =
    showRequired && requiredRuns > 0 && ballsLeft > 0
      ? ((requiredRuns * 6) / ballsLeft).toFixed(2)
      : "—";
  dom.liveStatus.textContent = canDeliverBall()
    ? `Live • ${state.oversLimit} Overs`
    : "Innings Complete";
}

function renderMatchInfo() {
  dom.matchTypeDisplay.textContent = dom.matchTypeInput.value || "T20";
  dom.matchTitleDisplay.textContent = dom.matchTitleInput.value || "Match Day";
  dom.matchVenueDisplay.textContent = dom.matchVenueInput.value || "Venue";
  dom.matchTimeDisplay.textContent = dom.matchTimeInput.value || "";
  dom.battingTeamName.textContent = dom.battingTeamInput.value || "Batting Team";
  dom.bowlingTeamName.textContent = dom.bowlingTeamInput.value || "Bowling Team";
  dom.targetRunsDisplay.textContent = state.chasing && state.target > 0 ? state.target : "—";
  dom.targetCard.style.opacity = state.chasing && state.target > 0 ? "1" : "0.35";
  dom.targetCard.style.filter = state.chasing && state.target > 0 ? "none" : "grayscale(0.6)";
  dom.inningsProgressLabel.textContent = state.chasing && state.target > 0 ? "Chase" : "1st Innings";
  dom.scoreRuns.textContent = state.runs;
  dom.scoreWickets.textContent = state.wickets;
}

function renderAll() {
  renderMatchInfo();
  renderAnalytics();
  renderExtras();
  renderFallOfWickets();
  renderBattingTable();
  updateLastBalls();
  renderSparkline();
  renderCurrentOverSummary();
}

function handleOversChange() {
  const overs = Math.min(Math.max(Number(dom.oversInput.value) || 20, 1), 50);
  dom.oversInput.value = overs;
  pushUndo();
  state.oversLimit = overs;
  if (state.ballsBowled > state.oversLimit * 6) {
    state.ballsBowled = state.oversLimit * 6;
  }
  renderAll();
}

function handleTargetChange() {
  pushUndo();
  state.target = Math.max(Number(dom.targetInput.value) || 0, 0);
  renderAll();
}

function handleChasingToggle() {
  pushUndo();
  state.chasing = dom.chasingToggle.checked;
  renderAll();
}

dom.runButtons.forEach((button) => button.addEventListener("click", handleRunButton));
dom.extraButtons.forEach((button) => button.addEventListener("click", handleExtraButton));
dom.wicketBtn.addEventListener("click", handleWicket);
dom.swapStrikeBtn.addEventListener("click", () => handleSwapStrike());
dom.undoBtn.addEventListener("click", handleUndo);
dom.resetBtn.addEventListener("click", handleReset);
dom.updateBattersBtn.addEventListener("click", handleUpdateBatters);
dom.matchTypeInput.addEventListener("input", renderAll);
dom.matchTitleInput.addEventListener("input", renderAll);
dom.matchVenueInput.addEventListener("input", renderAll);
dom.matchTimeInput.addEventListener("input", renderAll);
dom.battingTeamInput.addEventListener("input", renderAll);
dom.bowlingTeamInput.addEventListener("input", renderAll);
dom.oversInput.addEventListener("change", handleOversChange);
dom.targetInput.addEventListener("change", handleTargetChange);
dom.chasingToggle.addEventListener("change", handleChasingToggle);

renderAll();

