import * as db from '../server/db.js';

const questions = await db.getQuizQuestionsByPillar(1);
console.log('Pillar 1 questions:', questions.length);
if (questions.length > 0) {
  console.log('Sample question:', JSON.stringify(questions[0], null, 2));
}

process.exit(0);
