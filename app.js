const boardEl = document.querySelector("#board");
const appEl = document.querySelector(".app");
const padEl = document.querySelector("#numberPad");
const difficultyEl = document.querySelector("#difficulty");
const difficultyButtons = document.querySelectorAll("[data-difficulty]");
const timerEl = document.querySelector("#timer");
const mistakesEl = document.querySelector("#mistakes");
const filledEl = document.querySelector("#filled");
const bestTimeEl = document.querySelector("#bestTime");
const messageEl = document.querySelector("#message");
const notesToggle = document.querySelector("#notesToggle");
const eraseButton = document.querySelector("#erase");
const hintButton = document.querySelector("#hint");
const pauseButton = document.querySelector("#pause");
const newGameButton = document.querySelector("#newGame");
const pauseOverlay = document.querySelector("#pauseOverlay");
const winScreen = document.querySelector("#winScreen");
const winMessageEl = document.querySelector("#winMessage");
const playAgainButton = document.querySelector("#playAgain");

const BLANK = 0;
const BEST_TIMES_KEY = "sudokuBestTimes";
const DIFFICULTY = {
  easy: { clues: 42, label: "Einfach" },
  medium: { clues: 34, label: "Mittel" },
  hard: { clues: 29, label: "Schwer" },
  expert: { clues: 25, label: "Experte" }
};

let solution = [];
let puzzle = [];
let values = [];
let givens = [];
let notes = [];
let selected = 0;
let selectedCells = new Set();
let noteMode = false;
let mistakes = 0;
let startedAt = Date.now();
let elapsedBeforePause = 0;
let timerId = null;
let gameStarted = false;
let gameOver = false;
let isPaused = false;
let currentDifficulty = difficultyEl.value;
let hasPlayerSelection = false;
let isSelecting = false;
let didDragSelection = false;

function createEmptyGrid() {
  return Array.from({ length: 81 }, () => BLANK);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function canPlace(grid, index, number) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  for (let i = 0; i < 9; i += 1) {
    if (grid[row * 9 + i] === number || grid[i * 9 + col] === number) return false;
  }

  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxCol; c < boxCol + 3; c += 1) {
      if (grid[r * 9 + c] === number) return false;
    }
  }

  return true;
}

function solveGrid(grid, randomize = false) {
  const emptyIndex = grid.findIndex((value) => value === BLANK);
  if (emptyIndex === -1) return true;

  const numbers = randomize ? shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]) : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const number of numbers) {
    if (canPlace(grid, emptyIndex, number)) {
      grid[emptyIndex] = number;
      if (solveGrid(grid, randomize)) return true;
      grid[emptyIndex] = BLANK;
    }
  }

  return false;
}

function countSolutions(grid, limit = 2) {
  let count = 0;
  const testGrid = [...grid];

  function search() {
    if (count >= limit) return;

    let bestIndex = -1;
    let bestOptions = null;

    for (let i = 0; i < 81; i += 1) {
      if (testGrid[i] !== BLANK) continue;
      const options = [];
      for (let number = 1; number <= 9; number += 1) {
        if (canPlace(testGrid, i, number)) options.push(number);
      }
      if (options.length === 0) return;
      if (!bestOptions || options.length < bestOptions.length) {
        bestOptions = options;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) {
      count += 1;
      return;
    }

    for (const number of bestOptions) {
      testGrid[bestIndex] = number;
      search();
      testGrid[bestIndex] = BLANK;
      if (count >= limit) return;
    }
  }

  search();
  return count;
}

function generatePuzzle(level) {
  const full = createEmptyGrid();
  solveGrid(full, true);

  const targetClues = DIFFICULTY[level].clues;
  const puzzleGrid = [...full];
  const positions = shuffle(Array.from({ length: 81 }, (_, index) => index));
  let clues = 81;

  for (const index of positions) {
    if (clues <= targetClues) break;

    const backup = puzzleGrid[index];
    puzzleGrid[index] = BLANK;

    if (countSolutions(puzzleGrid, 2) !== 1) {
      puzzleGrid[index] = backup;
    } else {
      clues -= 1;
    }
  }

  return { puzzleGrid, full };
}

function renderBoard() {
  boardEl.innerHTML = "";
  for (let index = 0; index < 81; index += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `Feld ${Math.floor(index / 9) + 1}, ${index % 9 + 1}`);
    cell.dataset.index = index;
    cell.addEventListener("pointerdown", (event) => startCellSelection(event, index));
    cell.addEventListener("click", (event) => {
      if (didDragSelection) {
        event.preventDefault();
        didDragSelection = false;
      }
    });
    boardEl.append(cell);
  }
  paintBoard();
}

function paintBoard() {
  const selectedValue = values[selected];
  const selectedNumberComplete = isNumberComplete(selectedValue);
  const selectedRow = Math.floor(selected / 9);
  const selectedCol = selected % 9;
  const selectedBox = Math.floor(selectedRow / 3) * 3 + Math.floor(selectedCol / 3);

  [...boardEl.children].forEach((cell, index) => {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    const value = values[index];
    const numberComplete = isNumberComplete(value);

    cell.className = "cell";
    if (givens[index]) cell.classList.add("given");
    if (numberComplete) cell.classList.add("complete-number");
    if (gameStarted) {
      if (!numberComplete && selectedCells.has(index)) cell.classList.add("multi-selected");
      if (!numberComplete && index === selected) cell.classList.add("selected");
      else if (!selectedNumberComplete && (row === selectedRow || col === selectedCol || box === selectedBox)) cell.classList.add("related");
      if (!selectedNumberComplete && value && selectedValue && value === selectedValue) cell.classList.add("same");
      if (value && value !== solution[index]) cell.classList.add("error");
    }

    cell.innerHTML = "";
    if (value) {
      cell.textContent = value;
    } else if (notes[index].size) {
      const noteGrid = document.createElement("div");
      noteGrid.className = "notes";
      for (let number = 1; number <= 9; number += 1) {
        const note = document.createElement("span");
        const hasNote = notes[index].has(number);
        note.textContent = hasNote ? number : "";
        if (!selectedNumberComplete && hasNote && selectedValue && number === selectedValue) note.classList.add("selected-note");
        noteGrid.append(note);
      }
      cell.append(noteGrid);
    }
  });

  updateStats();
  updatePad();
}

function renderPad() {
  padEl.innerHTML = "";
  for (let number = 1; number <= 9; number += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = number;
    button.addEventListener("click", () => placeNumber(number));
    padEl.append(button);
  }
}

function updatePad() {
  [...padEl.children].forEach((button, index) => {
    const number = index + 1;
    const complete = isNumberComplete(number);
    button.classList.toggle("complete", complete);
    button.textContent = complete ? "" : number;
    button.setAttribute("aria-label", complete ? `Zahl ${number} vollständig` : `Zahl ${number}`);
    button.disabled = !gameStarted || gameOver || isPaused || complete;
  });
}

function isNumberComplete(number) {
  if (!number) return false;
  let count = 0;
  values.forEach((value, index) => {
    if (value === number && value === solution[index]) count += 1;
  });
  return count >= 9;
}

function selectCell(index) {
  if (!gameStarted || gameOver || isPaused) return;
  if (isNumberComplete(values[index])) return;
  selected = index;
  selectedCells = new Set([index]);
  hasPlayerSelection = true;
  paintBoard();
}

function placeNumber(number) {
  if (!gameStarted || gameOver || isPaused) return;
  if (isNumberComplete(number)) return;
  if (isNumberComplete(values[selected])) return;

  if (values[selected]) {
    selectNumberInstances(number);
    return;
  }

  if (noteMode || selectedCells.size > 1) {
    const targets = getEditableSelection().filter((index) => !values[index]);
    if (!targets.length) return;
    const shouldRemove = targets.every((index) => notes[index].has(number));
    targets.forEach((index) => {
      if (shouldRemove) notes[index].delete(number);
      else notes[index].add(number);
    });
    setMessage(shouldRemove ? `Notiz aus ${targets.length} Feld${targets.length === 1 ? "" : "ern"} entfernt.` : `Notiz in ${targets.length} Feld${targets.length === 1 ? "" : "er"} eingetragen.`);
    paintBoard();
    return;
  }

  if (givens[selected]) return;
  values[selected] = number;
  notes[selected].clear();

  if (number !== solution[selected]) {
    mistakes += 1;
    setMessage("Diese Zahl passt hier nicht.");
    if (mistakes >= 3) endGame(false);
  } else {
    clearNumberFromPeers(selected, number);
    setMessage("Gut gesetzt.");
  }

  paintBoard();
  if (!gameOver && values.every((value, index) => value === solution[index])) endGame(true);
}

function selectNumberInstances(number) {
  const matches = values
    .map((value, index) => ({ value, index }))
    .filter((entry) => entry.value === number)
    .map((entry) => entry.index);

  if (!matches.length) return;

  selected = matches[0];
  selectedCells = new Set(matches);
  hasPlayerSelection = true;
  paintBoard();
}

function getEditableSelection() {
  const indexes = selectedCells.size ? [...selectedCells] : [selected];
  return indexes.filter((index) => !givens[index] && !isNumberComplete(values[index]));
}

function clearNumberFromPeers(index, number) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  for (let i = 0; i < 9; i += 1) {
    notes[row * 9 + i].delete(number);
    notes[i * 9 + col].delete(number);
  }

  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxCol; c < boxCol + 3; c += 1) {
      notes[r * 9 + c].delete(number);
    }
  }
}

function eraseSelected() {
  if (!gameStarted || gameOver || isPaused) return;
  const targets = getEditableSelection();
  if (!targets.length) return;
  targets.forEach((index) => {
    values[index] = BLANK;
    notes[index].clear();
  });
  setMessage(`${targets.length} Feld${targets.length === 1 ? "" : "er"} geleert.`);
  paintBoard();
}

function giveHint() {
  if (!gameStarted || gameOver || isPaused) return;

  const emptyIndexes = values
    .map((value, index) => ({ value, index }))
    .filter((entry) => !entry.value && !givens[entry.index])
    .map((entry) => entry.index);

  if (!emptyIndexes.length) return;

  const index = hasPlayerSelection && !values[selected] && !givens[selected] ? selected : findHelpfulHintCell(emptyIndexes);
  selected = index;
  hasPlayerSelection = false;
  values[index] = solution[index];
  notes[index].clear();
  clearNumberFromPeers(index, solution[index]);
  setMessage("Ein Tipp wurde eingesetzt.");
  paintBoard();
  if (values.every((value, cellIndex) => value === solution[cellIndex])) endGame(true);
}

function findHelpfulHintCell(emptyIndexes) {
  const hintGrid = values.map((value, index) => (value === solution[index] ? value : BLANK));
  const rankedCells = emptyIndexes.map((index) => {
    const candidates = [];
    for (let number = 1; number <= 9; number += 1) {
      if (canPlace(hintGrid, index, number)) candidates.push(number);
    }
    return { index, candidates };
  });

  const fewestCandidates = Math.min(...rankedCells.map((cell) => cell.candidates.length || 10));
  const bestCells = rankedCells.filter((cell) => (cell.candidates.length || 10) === fewestCandidates);
  return shuffle(bestCells)[0].index;
}

function updateStats() {
  mistakesEl.textContent = mistakes;
  filledEl.textContent = values.filter(Boolean).length;
}

function updateTimer() {
  renderTimer(getElapsedSeconds());
}

function renderTimer(elapsed) {
  timerEl.textContent = formatElapsed(elapsed);
}

function formatElapsed(elapsed) {
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getElapsedSeconds() {
  return Math.floor((Date.now() - startedAt) / 1000);
}

function loadBestTimes() {
  try {
    const saved = localStorage.getItem(BEST_TIMES_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveBestTimes(bestTimes) {
  try {
    localStorage.setItem(BEST_TIMES_KEY, JSON.stringify(bestTimes));
  } catch {
    // Best scores are optional; the game should keep working without storage.
  }
}

function getBestTime(level = gameStarted ? currentDifficulty : difficultyEl.value) {
  const bestTimes = loadBestTimes();
  const bestTime = Number(bestTimes[level]);
  return Number.isFinite(bestTime) && bestTime > 0 ? bestTime : null;
}

function updateBestTimeDisplay() {
  const bestTime = getBestTime();
  bestTimeEl.textContent = bestTime ? formatElapsed(bestTime) : "--:--";
}

function recordBestTime(level, elapsed) {
  const bestTimes = loadBestTimes();
  const previous = Number(bestTimes[level]);
  if (Number.isFinite(previous) && previous > 0 && previous <= elapsed) return false;

  bestTimes[level] = elapsed;
  saveBestTimes(bestTimes);
  updateBestTimeDisplay();
  return true;
}

function setMessage(text) {
  messageEl.textContent = text;
}

function endGame(won) {
  const elapsed = getElapsedSeconds();
  const level = currentDifficulty;
  gameOver = true;
  isPaused = false;
  window.clearInterval(timerId);
  updatePauseUI();
  if (won) {
    setMessage("Gelöst. Sauber gespielt.");
  } else {
    setMessage("Drei Fehler erreicht. Starte einfach ein neues Spiel.");
  }
  if (won) {
    const isNewBest = recordBestTime(level, elapsed);
    const resultMessage = isNewBest ? `Neuer Rekord: ${formatElapsed(elapsed)} auf ${DIFFICULTY[level].label}.` : `Gewonnen in ${formatElapsed(elapsed)}.`;
    setMessage(resultMessage);
    winMessageEl.textContent = resultMessage;
  }
  updateWinUI(won);
  paintBoard();
}

function startGame() {
  gameStarted = true;
  gameOver = false;
  isPaused = false;
  mistakes = 0;
  selected = 0;
  selectedCells = new Set();
  hasPlayerSelection = false;
  isSelecting = false;
  didDragSelection = false;
  noteMode = false;
  notesToggle.setAttribute("aria-pressed", "false");
  notesToggle.textContent = "Notizen";
  updateWinUI(false);
  setMessage("Wähle ein Feld und setze eine Zahl.");
  updateStartUI();

  const level = difficultyEl.value;
  currentDifficulty = level;
  updateBestTimeDisplay();
  const generated = generatePuzzle(level);
  puzzle = generated.puzzleGrid;
  solution = generated.full;
  values = [...puzzle];
  givens = puzzle.map(Boolean);
  notes = Array.from({ length: 81 }, () => new Set());
  selected = Math.max(0, puzzle.findIndex((value) => value === BLANK));
  selectedCells = new Set([selected]);

  window.clearInterval(timerId);
  elapsedBeforePause = 0;
  startedAt = Date.now();
  updateTimer();
  timerId = window.setInterval(updateTimer, 1000);
  updatePauseUI();

  renderBoard();
}

function showStartScreen() {
  gameStarted = false;
  gameOver = false;
  isPaused = false;
  mistakes = 0;
  selected = 0;
  selectedCells = new Set();
  hasPlayerSelection = false;
  isSelecting = false;
  didDragSelection = false;
  noteMode = false;
  puzzle = createEmptyGrid();
  solution = createEmptyGrid();
  values = createEmptyGrid();
  givens = Array.from({ length: 81 }, () => false);
  notes = Array.from({ length: 81 }, () => new Set());
  window.clearInterval(timerId);
  elapsedBeforePause = 0;
  renderTimer(0);
  updateStats();
  setMessage("Wähle eine Schwierigkeit, dann startet dein Sudoku.");
  notesToggle.setAttribute("aria-pressed", "false");
  notesToggle.textContent = "Notizen";
  updateWinUI(false);
  updateStartUI();
  updatePauseUI();
  renderBoard();
}

function startGameWithDifficulty(level) {
  difficultyEl.value = level;
  startGame();
}

function startCellSelection(event, index) {
  if (!gameStarted || gameOver || isPaused) return;
  if (isNumberComplete(values[index])) return;
  event.preventDefault();
  isSelecting = true;
  didDragSelection = false;
  selected = index;
  selectedCells = new Set([index]);
  hasPlayerSelection = true;
  paintBoard();
}

function addCellToSelection(index) {
  if (isNumberComplete(values[index])) return;
  if (selectedCells.has(index)) return;
  selected = index;
  selectedCells.add(index);
  didDragSelection = true;
  hasPlayerSelection = true;
  paintBoard();
}

function finishCellSelection() {
  isSelecting = false;
}

boardEl.addEventListener("pointermove", (event) => {
  if (!isSelecting || !gameStarted || gameOver || isPaused) return;
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const cell = target && target.closest ? target.closest(".cell") : null;
  if (!cell || !boardEl.contains(cell)) return;
  addCellToSelection(Number(cell.dataset.index));
});

document.addEventListener("pointerup", finishCellSelection);
document.addEventListener("pointercancel", finishCellSelection);

notesToggle.addEventListener("click", () => {
  if (!gameStarted || isPaused || gameOver) return;
  noteMode = !noteMode;
  notesToggle.setAttribute("aria-pressed", String(noteMode));
  notesToggle.textContent = noteMode ? "Notizen an" : "Notizen";
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => startGameWithDifficulty(button.dataset.difficulty));
});
difficultyEl.addEventListener("change", () => {
  updateStartUI();
});
newGameButton.addEventListener("click", startGame);
eraseButton.addEventListener("click", eraseSelected);
hintButton.addEventListener("click", giveHint);
pauseButton.addEventListener("click", togglePause);
playAgainButton.addEventListener("click", showStartScreen);

function togglePause() {
  if (!gameStarted || gameOver) return;

  isPaused = !isPaused;
  if (isPaused) {
    elapsedBeforePause += Date.now() - startedAt;
    window.clearInterval(timerId);
    renderTimer(Math.floor(elapsedBeforePause / 1000));
    setMessage("Spiel pausiert.");
  } else {
    startedAt = Date.now() - elapsedBeforePause;
    timerId = window.setInterval(updateTimer, 1000);
    setMessage("Weiter geht's.");
  }

  isSelecting = false;
  updatePauseUI();
  paintBoard();
}

function updatePauseUI() {
  pauseButton.setAttribute("aria-pressed", String(isPaused));
  pauseButton.textContent = isPaused ? "Weiter" : "Pause";
  pauseButton.disabled = !gameStarted || gameOver;
  pauseOverlay.classList.toggle("visible", isPaused);
  pauseOverlay.setAttribute("aria-hidden", String(!isPaused));
  boardEl.classList.toggle("paused", isPaused);
  notesToggle.disabled = !gameStarted || isPaused || gameOver;
  eraseButton.disabled = !gameStarted || isPaused || gameOver;
  hintButton.disabled = !gameStarted || isPaused || gameOver;
}

function updateWinUI(isVisible) {
  winScreen.classList.toggle("visible", isVisible);
  winScreen.setAttribute("aria-hidden", String(!isVisible));
  boardEl.classList.toggle("finished", isVisible);
  if (!isVisible) winMessageEl.textContent = "Alles richtig gel\u00f6st.";
}

function updateStartUI() {
  appEl.classList.toggle("start-mode", !gameStarted);
  updateBestTimeDisplay();
  difficultyButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.difficulty === difficultyEl.value);
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "p") {
    togglePause();
    return;
  }
  if (!gameStarted || isPaused) return;
  if (event.key >= "1" && event.key <= "9") placeNumber(Number(event.key));
  if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") eraseSelected();
  if (event.key.toLowerCase() === "n") notesToggle.click();
  if (event.key.startsWith("Arrow")) {
    event.preventDefault();
    const row = Math.floor(selected / 9);
    const col = selected % 9;
    let nextSelected = selected;
    if (event.key === "ArrowUp") nextSelected = Math.max(0, row - 1) * 9 + col;
    if (event.key === "ArrowDown") nextSelected = Math.min(8, row + 1) * 9 + col;
    if (event.key === "ArrowLeft") nextSelected = row * 9 + Math.max(0, col - 1);
    if (event.key === "ArrowRight") nextSelected = row * 9 + Math.min(8, col + 1);
    if (isNumberComplete(values[nextSelected])) return;
    selected = nextSelected;
    selectedCells = new Set([nextSelected]);
    hasPlayerSelection = true;
    paintBoard();
  }
});

renderPad();
showStartScreen();
