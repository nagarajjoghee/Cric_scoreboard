const dom = {
  body: document.body,
  setupModal: document.getElementById("setupModal"),
  setupForm: document.getElementById("setupForm"),
  openSetupBtn: document.getElementById("openSetupBtn"),
  dismissSetupBtn: document.getElementById("dismissSetupBtn"),
  clearFormBtn: document.getElementById("clearFormBtn"),
  matchTypeSetup: document.getElementById("matchTypeSetup"),
  matchTitleSetup: document.getElementById("matchTitleSetup"),
  matchVenueSetup: document.getElementById("matchVenueSetup"),
  matchTimeSetup: document.getElementById("matchTimeSetup"),
  oversSetup: document.getElementById("oversSetup"),
  targetSetup: document.getElementById("targetSetup"),
  chasingSetup: document.getElementById("chasingSetup"),
  teamOneNameInput: document.getElementById("teamOneNameInput"),
  teamTwoNameInput: document.getElementById("teamTwoNameInput"),
  teamOnePlayersInput: document.getElementById("teamOnePlayersInput"),
  teamTwoPlayersInput: document.getElementById("teamTwoPlayersInput"),
  battingOrderInputs: document.querySelectorAll('input[name="battingOrder"]'),
  matchTypeDisplay: document.getElementById("matchTypeDisplay"),
  matchTitleDisplay: document.getElementById("matchTitleDisplay"),
  matchVenueDisplay: document.getElementById("matchVenueDisplay"),
  matchTimeDisplay: document.getElementById("matchTimeDisplay"),
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

const defaultConfig = {
  matchType: "NECA Tournament",
  matchTitle: "Awaiting Fixture",
  venue: "Venue to be confirmed",
  time: "Set during setup",
  overs: 20,
  target: 0,
  chasing: false,
  battingTeamName: "Team One",
  bowlingTeamName: "Team Two",
  battingPlayers: ["Batter 1", "Batter 2"],
  bowlingPlayers: ["Bowler 1", "Bowler 2"],
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const ensurePlayerList = (players, fallbackPrefix) => {
  const list = Array.isArray(players) ? players.filter(Boolean) : [];
  while (list.length < 2) {
    list.push(`${fallbackPrefix} ${list.length + 1}`);
  }
  return list;
};

const createInitialState = (config = defaultConfig) => {
  const battingPlayers = ensurePlayerList(config.battingPlayers, "Batter");
  const bowlingPlayers = ensurePlayerList(config.bowlingPlayers, "Bowler");
  const activeBatters = battingPlayers.slice(0, 2).map((name, index) => ({
    name,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    status: "not out",
    strike: index === 0,
  }));

  return {
    matchInfo: {
      type: config.matchType,
      title: config.matchTitle,
      venue: config.venue,
      time: config.time,
    },
    oversLimit: Math.min(Math.max(Number(config.overs) || 20, 1), 50),
    target: Math.max(Number(config.target) || 0, 0),
    chasing: Boolean(config.chasing && config.target),
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
    batters: activeBatters,
    bench: battingPlayers.slice(2),
    teamSheets: {
      batting: battingPlayers,
      bowling: bowlingPlayers,
    },
    battingTeamName: config.battingTeamName,
    bowlingTeamName: config.bowlingTeamName,
  };
};

let currentConfig = deepClone(defaultConfig);
let state = createInitialState(currentConfig);
let setupComplete = false;
const undoStack = [];

const pushUndo = () => {
  if (!setupComplete) return;
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
};

const restoreState = (snapshot) => {
  state = JSON.parse(snapshot);
  renderAll();
  syncBatterInputs();
};

const formatOvers = (balls) => {
  const overs = Math.floor(balls / 6);
  const ballsPart = balls % 6;
  return `${overs}.${ballsPart}`;
};

const showToast = (message) => {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.classList.remove("hidden");
  dom.toast.classList.add("visible");
  if (dom.toast.hideTimeout) clearTimeout(dom.toast.hideTimeout);
  dom.toast.hideTimeout = setTimeout(() => {
    dom.toast.classList.remove("visible");
    setTimeout(() => dom.toast.classList.add("hidden"), 350);
  }, 2200);
};

const canDeliverBall = () => setupComplete && state.ballsBowled < state.oversLimit * 6 && state.wickets < 10;

const getStriker = () =>
  state.batters.find((batter) => batter.status === "not out" && batter.strike);

const getNonStriker = () =>
  state.batters.find((batter) => batter.status === "not out" && !batter.strike);

const swapStrikeInternal = () => {
  const striker = getStriker();
  const nonStriker = getNonStriker();
  if (striker) striker.strike = false;
  if (nonStriker) nonStriker.strike = true;
};

const registerBallEvent = (event) => {
  const { label, runs, isBoundary, isWicket, ballCounts } = event;
  state.lastBalls.push({ label, isBoundary, isWicket });
  if (state.lastBalls.length > 6) state.lastBalls.shift();
  state.currentOverBalls.push({ label, runs, ballCounts });
};

const updatePowerplay = (ballBefore, runsAdded, wicketOccurred, ballCounts) => {
  if (ballBefore >= 36) return;
  const remainingBalls = 36 - ballBefore;
  state.powerplay.runs += runsAdded;
  if (wicketOccurred) state.powerplay.wickets += 1;
  if (ballCounts) state.powerplay.balls += Math.min(1, remainingBalls);
};

const finalizeDelivery = (ballCounts, strikeChanged) => {
  if (!ballCounts) return;
  state.ballsBowled += 1;
  const overComplete = state.ballsBowled > 0 && state.ballsBowled % 6 === 0;
  if (overComplete) {
    const overRuns = state.currentOverBalls.reduce((sum, entry) => sum + entry.runs, 0);
    state.overHistory.push(overRuns);
    state.currentOverBalls = [];
    if (!strikeChanged && state.wickets < 10) swapStrikeInternal();
  }
};

const syncBatterInputs = () => {
  const striker = getStriker();
  const nonStriker = getNonStriker();
  if (document.activeElement !== dom.strikerInput && striker) {
    dom.strikerInput.value = striker.name;
  }
  if (document.activeElement !== dom.nonStrikerInput && nonStriker) {
    dom.nonStrikerInput.value = nonStriker.name;
  }
};

const introduceNewBatter = () => {
  if (state.wickets >= 10) return;
  let name = state.bench.shift();
  if (!name) {
    const proposed = `Batter ${state.batters.length + 1}`;
    name = window.prompt("New batter to the crease:", proposed) || proposed;
  }
  const trimmed = name.trim() || `Batter ${state.batters.length + 1}`;
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
  showToast(`${trimmed} to the crease`);
  syncBatterInputs();
};

const guardIfNoSetup = () => {
  if (setupComplete) return false;
  showToast("Complete match setup first");
  openSetupModal();
  return true;
};

const handleRunButton = (event) => {
  if (guardIfNoSetup()) return;
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
  syncBatterInputs();
};

const handleExtraButton = (event) => {
  if (guardIfNoSetup()) return;
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
      break;
    case "bye":
      label = `B${runsAdded}`;
      if (striker) striker.balls += 1;
      state.partnership.runs += runsAdded;
      state.partnership.balls += 1;
      strikeChanged = runsAdded % 2 === 1;
      break;
    case "legBye":
      label = `Lb${runsAdded}`;
      if (striker) striker.balls += 1;
      state.partnership.runs += runsAdded;
      state.partnership.balls += 1;
      strikeChanged = runsAdded % 2 === 1;
      break;
    default:
      label = `+${runsAdded}`;
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
  syncBatterInputs();
};

const handleWicket = () => {
  if (guardIfNoSetup()) return;
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
  syncBatterInputs();
};

const handleSwapStrike = (manual = true) => {
  const striker = getStriker();
  const nonStriker = getNonStriker();
  if (!striker || !nonStriker) {
    if (manual) showToast("Two active batters required");
    return;
  }
  if (manual) pushUndo();
  striker.strike = false;
  nonStriker.strike = true;
  renderAll();
  syncBatterInputs();
};

const handleUndo = () => {
  const snapshot = undoStack.pop();
  if (!snapshot) {
    showToast("Nothing to undo");
    return;
  }
  restoreState(snapshot);
};

const handleReset = () => {
  if (guardIfNoSetup()) return;
  const confirmReset =
    state.runs === 0 && state.wickets === 0 && state.ballsBowled === 0
      ? true
      : window.confirm("Reset innings and clear all progress?");
  if (!confirmReset) return;
  state = createInitialState(currentConfig);
  undoStack.length = 0;
  renderAll();
  syncBatterInputs();
  showToast("Innings reset");
};

const handleUpdateBatters = () => {
  const striker = getStriker();
  const nonStriker = getNonStriker();
  if (!striker && !nonStriker) {
    showToast("Add batters via setup first");
    return;
  }
  pushUndo();
  if (striker) striker.name = dom.strikerInput.value.trim() || striker.name;
  if (nonStriker) nonStriker.name = dom.nonStrikerInput.value.trim() || nonStriker.name;
  renderAll();
  syncBatterInputs();
  showToast("Batters updated");
};

const formatPartnership = () => `${state.partnership.runs} (${state.partnership.balls})`;

const updateLastBalls = () => {
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
};

const renderBattingTable = () => {
  dom.battingTableBody.innerHTML = "";
  const benchRows = state.bench.map((name) => ({
    name,
    runs: "—",
    balls: "—",
    fours: "—",
    sixes: "—",
    strikeRate: "—",
    status: "Yet to bat",
  }));

  const activeRows = state.batters.map((batter) => ({
    name: `${batter.name}${batter.strike && batter.status === "not out" ? " •" : ""}`,
    runs: batter.runs,
    balls: batter.balls,
    fours: batter.fours,
    sixes: batter.sixes,
    strikeRate: batter.balls ? ((batter.runs / batter.balls) * 100).toFixed(1) : "0.0",
    status: batter.status === "not out" ? "Not out" : "Out",
  }));

  [...activeRows, ...benchRows].forEach((rowData) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${rowData.name}</td>
      <td>${rowData.runs}</td>
      <td>${rowData.balls}</td>
      <td>${rowData.fours}</td>
      <td>${rowData.sixes}</td>
      <td>${rowData.strikeRate}</td>
      <td>${rowData.status}</td>
    `;
    dom.battingTableBody.appendChild(row);
  });
};

const renderSparkline = () => {
  dom.runSparkline.innerHTML = "";
  const data = state.overHistory.slice(-6);
  if (!data.length) return;
  const max = Math.max(...data, 1);
  data.forEach((runs) => {
    const span = document.createElement("span");
    const height = Math.max(8, (runs / max) * 38);
    span.style.height = `${height}px`;
    dom.runSparkline.appendChild(span);
  });
};

const renderCurrentOverSummary = () => {
  if (!state.currentOverBalls.length) {
    dom.currentOverSummary.textContent = "—";
    return;
  }
  dom.currentOverSummary.textContent = state.currentOverBalls
    .map((entry) => entry.label)
    .join("  ");
};

const renderExtras = () => {
  const { wide, noBall, bye, legBye, penalty } = state.extras;
  const total = wide + noBall + bye + legBye + penalty;
  dom.extrasDisplay.textContent = `${total} (${bye}b, ${legBye}lb, ${noBall}nb, ${wide}wd, ${penalty}p)`;
};

const renderFallOfWickets = () => {
  dom.fowDisplay.textContent = state.fallOfWickets.length ? state.fallOfWickets.join(", ") : "—";
};

const renderAnalytics = () => {
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
  const ballsLeft = Math.max(state.oversLimit * 6 - state.ballsBowled, 0);
  dom.ballsLeftDisplay.textContent = ballsLeft;
  dom.oversRemainingDisplay.textContent = `${formatOvers(ballsLeft)} overs left`;
  const requiredRuns = state.target - state.runs;
  const showRequired = state.chasing && state.target > 0;
  dom.requiredRateMetric.style.display = showRequired ? "grid" : "none";
  dom.requiredRunsDisplay.textContent =
    showRequired && requiredRuns > 0 ? requiredRuns : showRequired ? 0 : "—";
  dom.requiredRunRate.textContent =
    showRequired && requiredRuns > 0 && ballsLeft > 0
      ? ((requiredRuns * 6) / ballsLeft).toFixed(2)
      : "—";
  dom.liveStatus.textContent = canDeliverBall()
    ? `Live • ${state.oversLimit} Overs`
    : setupComplete
    ? "Innings Complete"
    : "Awaiting Toss";
};

const renderMatchInfo = () => {
  dom.matchTypeDisplay.textContent = state.matchInfo.type || "NECA Tournament";
  dom.matchTitleDisplay.textContent = state.matchInfo.title || "Awaiting Fixture";
  dom.matchVenueDisplay.textContent = state.matchInfo.venue || "Venue";
  dom.matchTimeDisplay.textContent = state.matchInfo.time || "";
  dom.battingTeamName.textContent = state.battingTeamName || "Batting Team";
  dom.bowlingTeamName.textContent = state.bowlingTeamName || "Bowling Team";
  dom.targetRunsDisplay.textContent = state.chasing && state.target > 0 ? state.target : "—";
  dom.targetCard.style.opacity = state.chasing && state.target > 0 ? "1" : "0.35";
  dom.targetCard.style.filter = state.chasing && state.target > 0 ? "none" : "grayscale(0.6)";
  dom.inningsProgressLabel.textContent =
    state.chasing && state.target > 0 ? "Chase" : "1st Innings";
  dom.scoreRuns.textContent = state.runs;
  dom.scoreWickets.textContent = state.wickets;
};

const renderAll = () => {
  renderMatchInfo();
  renderAnalytics();
  renderExtras();
  renderFallOfWickets();
  renderBattingTable();
  updateLastBalls();
  renderSparkline();
  renderCurrentOverSummary();
};

const parsePlayers = (input) =>
  input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const getSelectedBattingTeam = () => {
  const checked = Array.from(dom.battingOrderInputs).find((radio) => radio.checked);
  return checked ? checked.value : "teamOne";
};

const populateSetupForm = (config) => {
  dom.matchTypeSetup.value = config.matchType || "NECA Tournament";
  dom.matchTitleSetup.value = config.matchTitle || "";
  dom.matchVenueSetup.value = config.venue || "";
  dom.matchTimeSetup.value = config.time || "";
  dom.oversSetup.value = config.overs || 20;
  dom.targetSetup.value = config.target || "";
  dom.chasingSetup.checked = Boolean(config.chasing && config.target);
  dom.teamOneNameInput.value = config.teamOneName || config.battingTeamName || "Team One";
  dom.teamTwoNameInput.value = config.teamTwoName || config.bowlingTeamName || "Team Two";
  dom.teamOnePlayersInput.value = (config.teamOnePlayers || config.battingPlayers || [])
    .join("\n")
    .trim();
  dom.teamTwoPlayersInput.value = (config.teamTwoPlayers || config.bowlingPlayers || [])
    .join("\n")
    .trim();
  const battingOrder = config.battingFirst === "teamTwo" ? "teamTwo" : "teamOne";
  dom.battingOrderInputs.forEach((radio) => {
    radio.checked = radio.value === battingOrder;
  });
  updateStartButtonLabel();
};

const updateStartButtonLabel = () => {
  const startButton = dom.setupForm.querySelector(".btn.start");
  if (!startButton) return;
  const hasProgress = setupComplete && (state.runs > 0 || state.wickets > 0 || state.ballsBowled > 0);
  startButton.textContent = hasProgress ? "Apply & Reset Match" : "Start Match";
};

const openSetupModal = () => {
  dom.setupModal.classList.add("visible");
  dom.body.classList.add("setup-open");
  populateSetupForm({
    ...currentConfig,
    teamOneName: currentConfig.teamOneName || currentConfig.battingTeamName,
    teamTwoName: currentConfig.teamTwoName || currentConfig.bowlingTeamName,
    teamOnePlayers: currentConfig.teamOnePlayers || currentConfig.battingPlayers,
    teamTwoPlayers: currentConfig.teamTwoPlayers || currentConfig.bowlingPlayers,
    battingFirst: currentConfig.battingFirst,
  });
};

const closeSetupModal = () => {
  dom.setupModal.classList.remove("visible");
  dom.body.classList.remove("setup-open");
};

const clearSetupForm = () => {
  dom.setupForm.reset();
  dom.matchTypeSetup.value = "NECA Tournament";
  dom.oversSetup.value = 20;
  dom.chasingSetup.checked = false;
  dom.targetSetup.value = "";
};

const applySetupConfig = (config) => {
  currentConfig = {
    matchType: config.matchType,
    matchTitle: config.matchTitle,
    venue: config.venue,
    time: config.time,
    overs: config.overs,
    target: config.chasing ? config.target : 0,
    chasing: config.chasing,
    battingTeamName: config.battingFirst === "teamOne" ? config.teamOneName : config.teamTwoName,
    bowlingTeamName: config.battingFirst === "teamOne" ? config.teamTwoName : config.teamOneName,
    battingPlayers:
      config.battingFirst === "teamOne" ? config.teamOnePlayers : config.teamTwoPlayers,
    bowlingPlayers:
      config.battingFirst === "teamOne" ? config.teamTwoPlayers : config.teamOnePlayers,
    teamOneName: config.teamOneName,
    teamTwoName: config.teamTwoName,
    teamOnePlayers: config.teamOnePlayers,
    teamTwoPlayers: config.teamTwoPlayers,
    battingFirst: config.battingFirst,
  };
  state = createInitialState(currentConfig);
  setupComplete = true;
  undoStack.length = 0;
  renderAll();
  syncBatterInputs();
  showToast("Match ready. All the best!");
};

const handleSetupSubmit = (event) => {
  event.preventDefault();
  const teamOnePlayers = parsePlayers(dom.teamOnePlayersInput.value);
  const teamTwoPlayers = parsePlayers(dom.teamTwoPlayersInput.value);

  if (teamOnePlayers.length < 2 || teamTwoPlayers.length < 2) {
    showToast("Enter at least two players per team");
    return;
  }

  const formConfig = {
    matchType: dom.matchTypeSetup.value.trim() || "NECA Tournament",
    matchTitle: dom.matchTitleSetup.value.trim() || "T20 Fixture",
    venue: dom.matchVenueSetup.value.trim() || "Venue TBC",
    time: dom.matchTimeSetup.value.trim() || "TBD",
    overs: Number(dom.oversSetup.value) || 20,
    target: Number(dom.targetSetup.value) || 0,
    chasing: dom.chasingSetup.checked && Number(dom.targetSetup.value) > 0,
    teamOneName: dom.teamOneNameInput.value.trim() || "Team One",
    teamTwoName: dom.teamTwoNameInput.value.trim() || "Team Two",
    teamOnePlayers,
    teamTwoPlayers,
    battingFirst: getSelectedBattingTeam(),
  };

  const requiresConfirm =
    setupComplete &&
    (state.runs > 0 || state.wickets > 0 || state.ballsBowled > 0) &&
    !window.confirm("Applying setup will reset the current innings. Continue?");

  if (requiresConfirm) return;

  applySetupConfig(formConfig);
  closeSetupModal();
};

const handleDismissSetup = () => {
  if (!setupComplete) {
    showToast("Complete setup to begin");
    return;
  }
  closeSetupModal();
};

dom.runButtons.forEach((button) => button.addEventListener("click", handleRunButton));
dom.extraButtons.forEach((button) => button.addEventListener("click", handleExtraButton));
dom.wicketBtn.addEventListener("click", handleWicket);
dom.swapStrikeBtn.addEventListener("click", () => handleSwapStrike());
dom.undoBtn.addEventListener("click", handleUndo);
dom.resetBtn.addEventListener("click", handleReset);
dom.updateBattersBtn.addEventListener("click", handleUpdateBatters);
dom.openSetupBtn.addEventListener("click", openSetupModal);
dom.dismissSetupBtn.addEventListener("click", handleDismissSetup);
dom.clearFormBtn.addEventListener("click", clearSetupForm);
dom.setupForm.addEventListener("submit", handleSetupSubmit);

renderAll();
syncBatterInputs();
openSetupModal();

