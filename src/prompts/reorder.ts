import { createPrompt, useState, useKeypress, isEnterKey, isUpKey, isDownKey } from '@inquirer/core';
import chalk from 'chalk';

interface ReorderConfig {
  message: string;
  items: string[];
}

export const reorderPrompt = createPrompt<string[], ReorderConfig>((config, done) => {
  const [items, setItems] = useState<string[]>(config.items);
  const [cursor, setCursor] = useState(0);

  useKeypress((key) => {
    if (isEnterKey(key)) {
      done(items);
      return;
    }

    if (isUpKey(key)) {
      setCursor(Math.max(0, cursor - 1));
    } else if (isDownKey(key)) {
      setCursor(Math.min(items.length - 1, cursor + 1));
    } else if (key.name === '1') {
      // Move highlighted item up (swap with item above)
      if (cursor > 0) {
        const next = [...items];
        [next[cursor - 1], next[cursor]] = [next[cursor], next[cursor - 1]];
        setItems(next);
        setCursor(cursor - 1);
      }
    } else if (key.name === '2') {
      // Move highlighted item down (swap with item below)
      if (cursor < items.length - 1) {
        const next = [...items];
        [next[cursor], next[cursor + 1]] = [next[cursor + 1], next[cursor]];
        setItems(next);
        setCursor(cursor + 1);
      }
    }
  });

  const header = [
    chalk.bold(config.message),
    chalk.dim('  ↑↓ navigate · 1 move up · 2 move down · Enter confirm'),
    '',
  ].join('\n');

  const lines = items.map((item, i) => {
    const marker = i === cursor ? chalk.cyan('❯') : ' ';
    const label = i === cursor ? chalk.cyan(item) : item;
    return `  ${marker} ${label}`;
  });

  return header + lines.join('\n');
});
