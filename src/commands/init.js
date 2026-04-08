import path from 'path';
import chalk from 'chalk';
import simpleGit from 'simple-git';
import { input, confirm } from '@inquirer/prompts';
import { mkdir, access, readFile } from '../utils/fs.js';
import { CONFIG_PATH, getRepoPath, setRepoPath } from '../config.js';

/**
 * `clawd-linker init` command handler.
 * Creates a git-initialized package repository and stores its path in ~/.clawd-linker.
 * If config already exists and points to a valid repo, warns and exits (INIT-02).
 */
export async function initCommand() {
  // INIT-02: Check if config already exists and is valid
  try {
    const content = await readFile(CONFIG_PATH, 'utf8');
    const config = JSON.parse(content);
    if (config.repoPath) {
      try {
        await access(config.repoPath);
        console.log(chalk.yellow(`Package repository already configured at: ${config.repoPath}`));
        console.log(chalk.yellow('To reconfigure, delete ~/.clawd-linker and run init again.'));
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
    default: path.join(process.env.HOME || process.env.USERPROFILE || '', 'clawd-packages'),
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
  console.log(`Next: run ${chalk.cyan('clawd-linker new <package-name>')} to create your first package.`);
}
