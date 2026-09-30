export function resolveLiveSessionId(session) {
  return session?.id || session?.sessionId || null;
}

export function shuffledItemIds(items, random = Math.random) {
  const ids = (items || []).map((item) => item.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [ids[index], ids[target]] = [ids[target], ids[index]];
  }
  return ids;
}

export function initialiseArrangeAnswers(questions, currentAnswers, random = Math.random) {
  let changed = false;
  const nextAnswers = { ...currentAnswers };
  for (const question of questions || []) {
    if (question.type !== 'arrange' || Array.isArray(currentAnswers[question.id])) continue;
    nextAnswers[question.id] = shuffledItemIds(question.items, random);
    changed = true;
  }
  return changed ? nextAnswers : currentAnswers;
}
