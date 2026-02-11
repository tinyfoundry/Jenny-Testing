const state = {
  contentMap: null,
  questionBank: [],
  history: [],
  mode: null,
  quiz: null,
  timerId: null,
  secondsLeft: 0,
  navStack: ["dashboard"],
};

const STORAGE_KEY = "dcfPrepV1";
const defaultProgress = { completedModules: {}, domainAccuracy: {}, weakDomains: [], examHistory: [], totalAnswered: 0, totalCorrect: 0 };

const $ = (id) => document.getElementById(id);
const views = ["dashboard","modules","practice","exam","adaptive","quiz","results"];

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

function updateTopScores() {
  const p = getProgress();
  const readiness = p.totalAnswered ? Math.round((p.totalCorrect / p.totalAnswered) * 100) : 0;
  const consistencyBoost = Math.min(15, (p.examHistory.slice(-5).filter(x => x.score >= 70).length * 3));
  const pass = Math.max(0, Math.min(99, Math.round(readiness * 0.85 + consistencyBoost)));
  $("readinessScore").textContent = `${readiness}%`;
  $("passLikelihood").textContent = `${pass}%`;
}

function renderOverview() {
  const p = getProgress();
  const completed = Object.values(p.completedModules).filter(Boolean).length;
  const weak = p.weakDomains.length ? p.weakDomains.join(", ") : "None yet";
  $("overview").innerHTML = `
    <h3>Progress Overview</h3>
    <p><strong>Completed Modules:</strong> ${completed}</p>
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
    const done = !!p.completedModules[m.module];
    const div = document.createElement("article");
    div.className = "module";
    div.innerHTML = `
      <h3>${idx + 1}. ${m.name}</h3>
      <p><strong>Estimated:</strong> ${m.estimated_minutes} min</p>
      <p>${m.flags.includes("high_risk") ? '<span class="pill risk">High-risk</span>' : ''}
         ${m.flags.includes("memorization_heavy") ? '<span class="pill memo">Memorization-heavy</span>' : ''}
         ${m.flags.includes("scenario_based") ? '<span class="pill scenario">Scenario-based</span>' : ''}</p>
      <button class="ghost" data-mod="${m.module}">${done ? "Mark Incomplete" : "Mark Complete"}</button>
    `;
    div.querySelector("button").addEventListener("click", (e) => {
      const id = e.target.dataset.mod;
      const prog = getProgress();
      prog.completedModules[id] = !prog.completedModules[id];
      saveProgress(prog); renderModules(); renderOverview(); updateTopScores();
    });
    wrap.appendChild(div);
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
    const domainIds = [...new Set((state.contentMap.domains || []).map(d => d.id).filter(Boolean))];
    const byDomain = domainIds.map(d => ({ domain: d, questions: shuffle(pool.filter(q => q.domain === d)) }));
    const picked = [];

    if (count >= domainIds.length) {
      byDomain.forEach(({ questions }) => {
        if (questions.length) picked.push(questions.shift());
      });
    }

    let i = 0;
    while (picked.length < count) {
      const bucket = byDomain[i % byDomain.length];
      if (bucket?.questions?.length) picked.push(bucket.questions.shift());
      i += 1;
      if (i > count * 20) break;
    }

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
  state.quiz = { title, questions, idx: 0, answers: {}, checked: false, startTs: Date.now() };
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
  state.quiz.checked = false;
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
  state.quiz.answers[q.id] = picked;
  const correct = arraysEqual([...q.correctAnswers].sort((a, b) => a - b), picked);

  if (state.mode !== "exam") {
    const wrongDetails = q.choices.map((_, i) => {
      if (q.correctAnswers.includes(i)) return `<li><strong>${q.choices[i]}</strong>: Correct choice per source summary.</li>`;
      return `<li><strong>${q.choices[i]}</strong>: ${q.whyWrong[i] || "Not aligned with source logic."}</li>`;
    }).join("");

    $("feedback").innerHTML = `
      <p class="${correct ? "feedback-ok" : "feedback-no"}"><strong>${correct ? "Correct" : "Incorrect"}</strong></p>
      <p>${q.explanation}</p>
      <details><summary>Why each option is right/wrong</summary><ul>${wrongDetails}</ul></details>
    `;
  }

  state.quiz.checked = true;
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
  updateTopScores();
  show("results");
}

function shuffle(arr) { return arr.map(v => [Math.random(), v]).sort((a,b) => a[0]-b[0]).map(x => x[1]); }
