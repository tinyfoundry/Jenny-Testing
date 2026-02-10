const state = {
  contentMap: null,
  questionBank: [],
  mode: null,
  quiz: null,
  timerId: null,
  secondsLeft: 0,
  navStack: ["dashboard"],
  activeModuleId: null,
};

const STORAGE_KEY = "dcfPrepV1";
const defaultProgress = {
  completedModules: {},
  moduleProgress: {},
  domainAccuracy: {},
  weakDomains: [],
  examHistory: [],
  totalAnswered: 0,
  totalCorrect: 0,
};

const $ = (id) => document.getElementById(id);
const views = ["dashboard", "modules", "moduleWorkbench", "practice", "exam", "adaptive", "quiz", "results"];

init();

async function init() {
  const [contentMap, questionData] = await Promise.all([
    fetch("data/content-map.json").then(r => r.json()),
    fetch("data/question-bank.json").then(r => r.json())
  ]);
  state.contentMap = contentMap;
  state.questionBank = questionData.questions;
  wireEvents();
  renderModules();
  renderPracticeDomains();
  renderOverview();
  updateTopScores();
}

function wireEvents() {
  document.querySelectorAll("[data-view]").forEach(btn => btn.addEventListener("click", () => show(btn.dataset.view)));
  $("backBtn").addEventListener("click", goBack);
  $("startPractice").addEventListener("click", startPractice);
  $("startExam").addEventListener("click", startExam);
  $("startAdaptive").addEventListener("click", startAdaptive);
  $("submitAnswer").addEventListener("click", submitAnswer);
  $("nextQuestion").addEventListener("click", nextQuestion);
  $("finishQuiz").addEventListener("click", finishQuiz);
  $("toDashboard").addEventListener("click", () => show("dashboard", true));
}

function show(id, resetNav = false) {
  if (resetNav) state.navStack = ["dashboard"];
  views.forEach(v => $(v).classList.toggle("hidden", v !== id));
  if (!resetNav && state.navStack[state.navStack.length - 1] !== id) state.navStack.push(id);
}

function goBack() {
  if (state.navStack.length <= 1) return;
  state.navStack.pop();
  const prev = state.navStack[state.navStack.length - 1];
  views.forEach(v => $(v).classList.toggle("hidden", v !== prev));
}

function getProgress() {
  try { return { ...defaultProgress, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
  catch { return { ...defaultProgress }; }
}
function saveProgress(p) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }

function moduleLikelyPass(moduleId, p) {
  const m = p.moduleProgress[moduleId] || {};
  const completed = Object.values(m).filter(Boolean).length;
  return Math.round((completed / 10) * 100);
}

function updateTopScores() {
  const p = getProgress();
  const readiness = p.totalAnswered ? Math.round((p.totalCorrect / p.totalAnswered) * 100) : 0;
  const moduleAvg = state.contentMap?.recommended_learning_path?.length
    ? Math.round(state.contentMap.recommended_learning_path.reduce((acc, m) => acc + moduleLikelyPass(m.module, p), 0) / state.contentMap.recommended_learning_path.length)
    : 0;
  const consistencyBoost = Math.min(12, (p.examHistory.slice(-5).filter(x => x.score >= 70).length * 2));
  const pass = Math.max(0, Math.min(99, Math.round(readiness * 0.65 + moduleAvg * 0.25 + consistencyBoost)));
  $("readinessScore").textContent = `${readiness}%`;
  $("passLikelihood").textContent = `${pass}%`;
}

function renderOverview() {
  const p = getProgress();
  const completed = Object.values(p.completedModules).filter(Boolean).length;
  const weak = p.weakDomains.length ? p.weakDomains.join(", ") : "None yet";
  $("overview").innerHTML = `
    <h3>Progress Overview</h3>
    <p><strong>Completed Modules:</strong> ${completed}/${state.contentMap.recommended_learning_path.length}</p>
    <p><strong>Total Questions Answered:</strong> ${p.totalAnswered}</p>
    <p><strong>Weak Areas:</strong> ${weak}</p>
    <p class="small">Data is stored in local browser storage for easy static deployment.</p>
  `;
}

function renderModules() {
  const p = getProgress();
  const wrap = $("moduleList");
  wrap.innerHTML = "";
  state.contentMap.recommended_learning_path.forEach((m, idx) => {
    const doneLevels = Object.values(p.moduleProgress[m.module] || {}).filter(Boolean).length;
    const likely = moduleLikelyPass(m.module, p);
    const div = document.createElement("article");
    div.className = "module module-card";
    div.innerHTML = `
      <h3>${idx + 1}. ${m.name}</h3>
      <p><strong>Total time:</strong> ~45 min • <strong>10 levels</strong> (~4–5 min each)</p>
      <p>${m.flags.includes("high_risk") ? '<span class="pill risk">High-risk</span>' : ''}
         ${m.flags.includes("memorization_heavy") ? '<span class="pill memo">Memorization-heavy</span>' : ''}
         ${m.flags.includes("scenario_based") ? '<span class="pill scenario">Scenario-based</span>' : ''}</p>
      <p class="small"><strong>Progress:</strong> ${doneLevels}/10 levels • <strong>Module knowledge:</strong> ${likely}%</p>
      <button class="action" data-open-module="${m.module}">Open Study Tools</button>
    `;
    div.querySelector("button").addEventListener("click", (e) => openModuleWorkbench(e.target.dataset.openModule));
    wrap.appendChild(div);
  });
}

function createLevelsForModule(moduleId) {
  const domainMap = { M1: "D1", M2: "D2", M3: "D3", M4: "D3", M5: "D4", M6: "D4" };
  const domain = state.contentMap.domains.find(d => d.id === domainMap[moduleId]) || state.contentMap.domains[0];
  const objectives = domain.topics.flatMap(t => t.subtopics.flatMap(s => s.learning_objectives.map(lo => ({ topic: t.name, subtopic: s.name, lo }))));
  const levels = [];
  for (let i = 0; i < 10; i++) {
    const base = objectives[i % objectives.length];
    const distractor = objectives[(i + 3) % objectives.length]?.lo || objectives[0].lo;
    levels.push({
      id: `L${i + 1}`,
      title: `Level ${i + 1}`,
      est: "4–5 min",
      flashFront: base.topic,
      flashBack: base.lo,
      miniQ: {
        prompt: `Which statement aligns with this level focus (${base.subtopic})?`,
        choices: [base.lo, distractor],
        correct: 0
      }
    });
  }
  return levels;
}

function openModuleWorkbench(moduleId) {
  state.activeModuleId = moduleId;
  const mod = state.contentMap.recommended_learning_path.find(x => x.module === moduleId);
  const p = getProgress();
  const levels = createLevelsForModule(moduleId);
  const doneLevels = Object.values(p.moduleProgress[moduleId] || {}).filter(Boolean).length;
  $("workbenchTitle").textContent = `${mod.name} • Study Tools`;
  $("workbenchMeta").textContent = `10 levels • ~45 minutes total • knowledge ${moduleLikelyPass(moduleId, p)}%`;
  $("moduleProgressFill").style.width = `${(doneLevels / 10) * 100}%`;

  $("levelCards").innerHTML = levels.map((l, idx) => {
    const done = !!(p.moduleProgress[moduleId] || {})[l.id];
    return `<article class="module level-card">
      <h4>${l.title}</h4>
      <p class="small">${l.est}</p>
      <p class="small">Flashcard + mini-check</p>
      <p>${done ? '<span class="pill scenario">Completed</span>' : '<span class="pill">Not started</span>'}</p>
      <button class="ghost" data-level="${idx}">Start ${l.title}</button>
    </article>`;
  }).join("");

  document.querySelectorAll("[data-level]").forEach(btn => btn.addEventListener("click", (e) => openLevelTool(levels[Number(e.target.dataset.level)])));
  $("levelTool").classList.add("hidden");
  show("moduleWorkbench");
}

function openLevelTool(level) {
  const host = $("levelTool");
  host.classList.remove("hidden");
  host.innerHTML = `
    <hr />
    <h3>${level.title}</h3>
    <p class="small">Tool 1: Flashcard (click to flip)</p>
    <button id="flashCard" class="flashcard" data-side="front"><strong>${level.flashFront}</strong></button>
    <p class="small">Tool 2: Mini-check</p>
    <p><strong>${level.miniQ.prompt}</strong></p>
    ${level.miniQ.choices.map((c, i) => `<label class="choice"><input type="radio" name="lvlMini" value="${i}"/> ${c}</label>`).join("")}
    <div class="row">
      <button id="submitLevel" class="action">Submit Level Check</button>
    </div>
    <div id="levelFeedback"></div>
  `;

  $("flashCard").addEventListener("click", () => {
    const card = $("flashCard");
    const side = card.dataset.side;
    if (side === "front") {
      card.dataset.side = "back";
      card.innerHTML = `<span>${level.flashBack}</span>`;
      card.classList.add("flipped");
    } else {
      card.dataset.side = "front";
      card.innerHTML = `<strong>${level.flashFront}</strong>`;
      card.classList.remove("flipped");
    }
  });

  $("submitLevel").addEventListener("click", () => {
    const picked = document.querySelector("input[name='lvlMini']:checked");
    if (!picked) {
      $("levelFeedback").innerHTML = `<p class="feedback-no">Pick an answer before submitting.</p>`;
      return;
    }
    const correct = Number(picked.value) === level.miniQ.correct;
    const p = getProgress();
    p.moduleProgress[state.activeModuleId] = p.moduleProgress[state.activeModuleId] || {};
    if (correct) p.moduleProgress[state.activeModuleId][level.id] = true;

    const completedCount = Object.values(p.moduleProgress[state.activeModuleId]).filter(Boolean).length;
    if (completedCount >= 10) p.completedModules[state.activeModuleId] = true;

    saveProgress(p);
    updateTopScores();
    renderOverview();
    renderModules();
    openModuleWorkbench(state.activeModuleId);

    $("levelFeedback").innerHTML = `<p class="${correct ? "feedback-ok" : "feedback-no"}">${correct ? "Great work. Level completed." : "Not quite. Review flashcard and retry this level."}</p>`;
  });
}

function renderPracticeDomains() {
  const select = $("practiceDomain");
  select.innerHTML = `<option value="ALL">All Domains</option>`;
  state.contentMap.domains.forEach(d => {
    const o = document.createElement("option");
    o.value = d.id; o.textContent = `${d.id} - ${d.name}`; select.appendChild(o);
  });
}

function pickQuestions({ mode, count, domain }) {
  let pool = [...state.questionBank];
  if (domain && domain !== "ALL") pool = pool.filter(q => q.domain === domain);

  if (mode === "adaptive") {
    const p = getProgress();
    const weakSet = new Set(p.weakDomains);
    pool.sort((a, b) => {
      const aw = weakSet.has(a.domain) ? -1 : 0;
      const bw = weakSet.has(b.domain) ? -1 : 0;
      const diffRank = { easy: 1, medium: 2, hard: 3 };
      return (aw - bw) || (diffRank[b.difficulty] - diffRank[a.difficulty]);
    });
  } else if (mode === "exam") {
    const weights = { D1: 0.2, D2: 0.2, D3: 0.25, D4: 0.35 };
    const picked = [];
    Object.entries(weights).forEach(([d, w]) => {
      const target = Math.max(1, Math.round(count * w));
      picked.push(...shuffle(pool.filter(q => q.domain === d)).slice(0, target));
    });
    return shuffle([...new Map(picked.map(q => [q.id, q])).values()]).slice(0, count);
  }

  return shuffle(pool).slice(0, Math.min(count, pool.length));
}

function startPractice() {
  const domain = $("practiceDomain").value;
  const count = Number($("practiceCount").value);
  startQuiz({ mode: "practice", title: `Practice: ${domain === "ALL" ? "Mixed" : domain}`, questions: pickQuestions({ mode: "practice", count, domain }) });
}

function startExam() {
  const size = $("examSize").value;
  const count = size === "mini" ? 15 : 30;
  const minutes = size === "mini" ? 20 : 45;
  startQuiz({ mode: "exam", title: `Exam Simulation (${size})`, questions: pickQuestions({ mode: "exam", count, domain: "ALL" }), timedMinutes: minutes });
}

function startAdaptive() {
  const p = getProgress();
  $("adaptiveInfo").textContent = `Weak domains targeted: ${p.weakDomains.join(", ") || "none yet (mixed set)"}`;
  startQuiz({ mode: "adaptive", title: "Adaptive Session", questions: pickQuestions({ mode: "adaptive", count: 12, domain: "ALL" }) });
}

function startQuiz({ mode, title, questions, timedMinutes = 0 }) {
  state.mode = mode;
  state.quiz = { title, questions, idx: 0, answers: {}, checked: false };
  $("quizTitle").textContent = title;
  show("quiz");
  if (timedMinutes) startTimer(timedMinutes * 60); else stopTimer();
  renderQuestion();
}

function startTimer(seconds) {
  stopTimer();
  state.secondsLeft = seconds;
  $("timer").classList.remove("hidden");
  tick();
  state.timerId = setInterval(tick, 1000);
}
function tick() {
  const m = String(Math.floor(state.secondsLeft / 60)).padStart(2, "0");
  const s = String(state.secondsLeft % 60).padStart(2, "0");
  $("timer").textContent = `Time Left: ${m}:${s}`;
  if (state.secondsLeft <= 0) { finishQuiz(); return; }
  state.secondsLeft -= 1;
}
function stopTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
  $("timer").classList.add("hidden");
}

function renderQuestion() {
  const q = state.quiz.questions[state.quiz.idx];
  $("feedback").innerHTML = "";
  $("nextQuestion").classList.add("hidden");
  $("finishQuiz").classList.toggle("hidden", state.quiz.idx < state.quiz.questions.length - 1);
  $("quizMeta").textContent = `Q ${state.quiz.idx + 1} / ${state.quiz.questions.length} • ${q.domain} • ${q.difficulty}`;

  const inputType = q.type === "multi" ? "checkbox" : "radio";
  const name = `q_${q.id}`;
  const options = q.choices.map((c, i) => `<label class="choice"><input type="${inputType}" name="${name}" value="${i}"/> ${c}</label>`).join("");
  $("questionWrap").innerHTML = `<div class="question">${q.prompt}</div><div>${options}</div>`;
}

function selectedAnswers() {
  const q = state.quiz.questions[state.quiz.idx];
  const inputs = [...document.querySelectorAll(`input[name='q_${q.id}']:checked`)];
  return inputs.map(i => Number(i.value)).sort((a, b) => a - b);
}
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((x, i) => x === b[i]);
}

function submitAnswer() {
  const q = state.quiz.questions[state.quiz.idx];
  const picked = selectedAnswers();
  if (!picked.length) {
    $("feedback").innerHTML = `<p class="feedback-no">Please pick an answer before submitting.</p>`;
    return;
  }

  state.quiz.answers[q.id] = picked;
  const correct = arraysEqual([...q.correctAnswers].sort((a, b) => a - b), picked);

  if (state.mode === "exam") {
    if (state.quiz.idx < state.quiz.questions.length - 1) nextQuestion();
    return;
  }

  const wrongDetails = q.choices.map((_, i) => {
    if (q.correctAnswers.includes(i)) return `<li><strong>${q.choices[i]}</strong>: Correct choice per source summary.</li>`;
    return `<li><strong>${q.choices[i]}</strong>: ${q.whyWrong[i] || "Not aligned with source logic."}</li>`;
  }).join("");

  $("feedback").innerHTML = `
    <p class="${correct ? "feedback-ok" : "feedback-no"}"><strong>${correct ? "Correct" : "Incorrect"}</strong></p>
    <p>${q.explanation}</p>
    <details><summary>Why each option is right/wrong</summary><ul>${wrongDetails}</ul></details>
  `;

  if (state.quiz.idx < state.quiz.questions.length - 1) $("nextQuestion").classList.remove("hidden");
}

function nextQuestion() {
  state.quiz.idx += 1;
  renderQuestion();
}

function finishQuiz() {
  stopTimer();
  const qset = state.quiz.questions;
  let correct = 0;
  const byDomain = {};

  qset.forEach(q => {
    const ans = (state.quiz.answers[q.id] || []).slice().sort((a, b) => a - b);
    const ok = arraysEqual([...q.correctAnswers].sort((a, b) => a - b), ans);
    if (ok) correct += 1;
    if (!byDomain[q.domain]) byDomain[q.domain] = { total: 0, correct: 0 };
    byDomain[q.domain].total += 1;
    if (ok) byDomain[q.domain].correct += 1;
  });

  const score = Math.round((correct / qset.length) * 100);
  const p = getProgress();
  p.totalAnswered += qset.length;
  p.totalCorrect += correct;

  Object.entries(byDomain).forEach(([d, x]) => {
    p.domainAccuracy[d] = Math.round((x.correct / x.total) * 100);
  });
  p.weakDomains = Object.entries(p.domainAccuracy).filter(([, v]) => v < 70).map(([d]) => d);

  if (state.mode === "exam") p.examHistory.push({ when: new Date().toISOString(), score, byDomain });
  saveProgress(p);

  const breakdown = Object.entries(byDomain).map(([d, x]) => `<li>${d}: ${x.correct}/${x.total} (${Math.round((x.correct / x.total) * 100)}%)</li>`).join("");
  const review = qset.map((q, i) => {
    const ans = state.quiz.answers[q.id] || [];
    const ok = arraysEqual([...q.correctAnswers].sort((a,b)=>a-b), [...ans].sort((a,b)=>a-b));
    return `<li><strong>Q${i+1}:</strong> ${q.prompt}<br/><span class='${ok ? "feedback-ok" : "feedback-no"}'>${ok ? "Correct" : "Incorrect"}</span> • Correct: ${q.correctAnswers.map(i=>q.choices[i]).join(", ")}</li>`;
  }).join("");

  $("resultsBody").innerHTML = `
    <p><strong>Score:</strong> ${score}% (${correct}/${qset.length})</p>
    <h3>Domain Breakdown</h3><ul>${breakdown}</ul>
    <h3>Review</h3><ol>${review}</ol>
  `;

  renderOverview();
  renderModules();
  updateTopScores();
  show("results");
}

function shuffle(arr) { return arr.map(v => [Math.random(), v]).sort((a,b) => a[0]-b[0]).map(x => x[1]); }
