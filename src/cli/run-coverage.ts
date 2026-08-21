import { spawn } from 'node:child_process';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { CoverageCommandError } from '../errors.js';

type SpawnCoverageCommand = (command: string, options: SpawnOptions) => ChildProcess;

export interface RunCoverageOptions {
  stdout?: 'inherit' | 'stderr';
}

function startupError(command: string, cause: unknown): CoverageCommandError {
  return new CoverageCommandError(`Coverage command could not start: ${command}`, { cause });
}

export function runCoverageCommand(
  command: string,
  projectRoot: string,
  options: RunCoverageOptions = {},
  spawnCommand: SpawnCoverageCommand = spawn,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      const stdio: SpawnOptions['stdio'] = options.stdout === 'stderr'
        ? ['inherit', 2, 'inherit']
        : 'inherit';
      child = spawnCommand(command, { cwd: projectRoot, shell: true, stdio });
    } catch (error) {
      reject(startupError(command, error));
      return;
    }

    child.once('error', (error) => reject(startupError(command, error)));
    child.once('close', (status, signal) => {
      if (signal !== null) {
        reject(new CoverageCommandError(
          `Coverage command terminated by signal ${signal}: ${command}`,
        ));
        return;
      }
      if (status !== 0) {
        reject(new CoverageCommandError(`Coverage command failed with status ${status}: ${command}`));
        return;
      }
      resolve();
    });
  });
}
