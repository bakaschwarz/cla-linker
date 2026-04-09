import { readFile, mkdir, access } from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import { simpleGit } from 'simple-git';
import { CONFIG_PATH, setRepoPath } from '../config.js';

export async function initCommand(): Promise<void> {
  // INIT-02: Check if config already exists and is valid
  try {
    const content = await readFile(CONFIG_PATH, 'utf8');
    const config = JSON.parse(content) as { repoPath?: string };
    if (config.repoPath) {
      try {
        await access(config.repoPath);
        console.log(chalk.yellow(`Package repository already configured at: ${config.repoPath}`));
        console.log(chalk.yellow('To reconfigure, delete ~/.cla-linker and run init again.'));
        return;
      } catch {
        // Config exists but repo path invalid — allow re-init
        console.log(chalk.yellow(`Previous repo path (${config.repoPath}) no longer exists. Reconfiguring...`));
      }
    }
  } catch {
    // No config file — proceed with init
  }

  // INIT-01: Ask for repo path
  const repoPath = await input({
    message: 'Where should the package repository be created?',
    default: path.join(process.env['HOME'] ?? process.env['USERPROFILE'] ?? '', 'cla-packages'),
  });

  const resolved = path.resolve(repoPath);

  // Create directory and git init
  await mkdir(resolved, { recursive: true });
  const git = simpleGit(resolved);
  await git.init();

  // Store in config
  await setRepoPath(resolved);

  console.log(chalk.green(`Package repository created at: ${resolved}`));
  console.log(chalk.green(`Config saved to: ${CONFIG_PATH}`));
  console.log('');
  console.log(`Next: run ${chalk.cyan('cla-linker new <package-name>')} to create your first package.`);
}
