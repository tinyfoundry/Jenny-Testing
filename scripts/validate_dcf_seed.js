const fs = require('fs');

const bank = JSON.parse(fs.readFileSync('dcf_question_seed.json', 'utf8'));
const expectedDomains = ["BOS25", "CAAN", "SNP", "RNRF", "SDGR", "HSAN"];

const domainCounts = Object.fromEntries(expectedDomains.map(d => [d, 0]));
const diffCounts = { easy: 0, medium: 0, hard: 0 };

for (const q of bank.questions) {
  if (!domainCounts.hasOwnProperty(q.domain)) {
    throw new Error(`Unexpected domain: ${q.domain}`);
  }
  domainCounts[q.domain] += 1;
  if (!diffCounts.hasOwnProperty(q.difficulty)) {
    throw new Error(`Unexpected difficulty: ${q.difficulty}`);
  }
  diffCounts[q.difficulty] += 1;

  const deep = q?.rationale?.deep || '';
  if (!deep.startsWith(`The correct answer is ${q.correct_answer} because in ${q.domain}, section`)) {
    throw new Error(`Rationale format mismatch for ${q.id}`);
  }
  if (deep.includes('Based on source material') || deep.includes('According to the guide')) {
    throw new Error(`Banned rationale phrase in ${q.id}`);
  }
}

const total = bank.questions.length;
console.log('Total questions:', total);
console.log('Domain counts:', domainCounts);
console.log('Difficulty counts:', diffCounts);

const allDomainsCovered = expectedDomains.every(d => domainCounts[d] > 0);
console.log('All 6 domains covered:', allDomainsCovered ? 'YES' : 'NO');

if (total < 500) throw new Error('Bank has fewer than 500 questions');
if (!allDomainsCovered) throw new Error('Not all 6 domains covered');

for (const d of expectedDomains) {
  if (domainCounts[d] < 80 || domainCounts[d] > 85) {
    throw new Error(`Domain ${d} not in 80-85 range: ${domainCounts[d]}`);
  }
}

const easyPct = diffCounts.easy / total;
const medPct = diffCounts.medium / total;
const hardPct = diffCounts.hard / total;

console.log('Difficulty ratio:', {
  easy: easyPct.toFixed(3),
  medium: medPct.toFixed(3),
  hard: hardPct.toFixed(3),
});

if (Math.abs(easyPct - 0.30) > 0.03) throw new Error('Easy ratio out of tolerance');
if (Math.abs(medPct - 0.40) > 0.03) throw new Error('Medium ratio out of tolerance');
if (Math.abs(hardPct - 0.30) > 0.03) throw new Error('Hard ratio out of tolerance');

console.log('Validation: PASS');
