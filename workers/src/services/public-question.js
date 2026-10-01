// Never derive a student's display order from the answer key. Randomize the
// original item list independently, including when it happens to be correct.
export function publicArrangeItems(question) {
  const items = [...(question.items || [])];
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
    [items[index], items[target]] = [items[target], items[index]];
  }
  return items;
}
