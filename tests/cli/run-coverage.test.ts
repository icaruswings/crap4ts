import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { runCoverageCommand } from '../../src/cli/run-coverage.js';
import { CoverageCommandError } from '../../src/errors.js';

const temporaryDirectories: string[] = [];

async function makeProject(): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'crap4ts-run-coverage-'));
  temporaryDirectories.push(projectRoot);
  return projectRoot;
}

function nodeExitCommand(status: number): string {
  return `${JSON.stringify(process.execPath)} -e "process.exit(${status})"`;
}

function childProcessThat(emission: 'error' | 'close', status: number | null, signal: NodeJS.Signals | null): ChildProcess {
  const child = new EventEmitter() as ChildProcess;
  queueMicrotask(() => {
    if (emission === 'error') child.emit('error', new Error('spawn failed'));
    else child.emit('close', status, signal);
  });
  return child;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('runCoverageCommand', () => {
  it('runs an explicit Node command that exits successfully', async () => {
    const projectRoot = await makeProject();

    await expect(runCoverageCommand(nodeExitCommand(0), projectRoot)).resolves.toBeUndefined();
  });

  it('passes the supplied command unchanged with project cwd, shell, and inherited stdio', async () => {
    const projectRoot = await makeProject();
    const command = 'npm run coverage -- --runInBand';
    const calls: Array<{ command: string; options: SpawnOptions }> = [];
    const spawnCommand = (suppliedCommand: string, options: SpawnOptions): ChildProcess => {
      calls.push({ command: suppliedCommand, options });
      return childProcessThat('close', 0, null);
    };

    await runCoverageCommand(command, projectRoot, {}, spawnCommand);

    expect(calls).toEqual([{
      command,
      options: { cwd: projectRoot, shell: true, stdio: 'inherit' },
    }]);
  });

  it('routes coverage stdout to stderr when JSON output must stay clean', async () => {
    const projectRoot = await makeProject();
    const command = 'npm run coverage';
    const calls: Array<{ command: string; options: SpawnOptions }> = [];
    const spawnCommand = (suppliedCommand: string, options: SpawnOptions): ChildProcess => {
      calls.push({ command: suppliedCommand, options });
      return childProcessThat('close', 0, null);
    };

    await runCoverageCommand(command, projectRoot, { stdout: 'stderr' }, spawnCommand);

    expect(calls).toEqual([{
      command,
      options: { cwd: projectRoot, shell: true, stdio: ['inherit', 2, 'inherit'] },
    }]);
  });

  it('rejects a nonzero status with the command and status', async () => {
    const projectRoot = await makeProject();
    const command = nodeExitCommand(7);

    const error = await runCoverageCommand(command, projectRoot).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(CoverageCommandError);
    expect(error).toHaveProperty('message', `Coverage command failed with status 7: ${command}`);
  });

  it('rejects a spawn error with CoverageCommandError', async () => {
    const projectRoot = await makeProject();
    const command = 'missing-coverage-command';
    const spawnCommand = (): ChildProcess => childProcessThat('error', null, null);

    const error = await runCoverageCommand(command, projectRoot, {}, spawnCommand).catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(CoverageCommandError);
    expect(error).toHaveProperty('message', `Coverage command could not start: ${command}`);
  });

  it('rejects a signal exit with CoverageCommandError', async () => {
    const projectRoot = await makeProject();
    const command = 'npm run coverage';
    const spawnCommand = (): ChildProcess => childProcessThat('close', null, 'SIGTERM');

    const error = await runCoverageCommand(command, projectRoot, {}, spawnCommand).catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(CoverageCommandError);
    expect(error).toHaveProperty(
      'message',
      `Coverage command terminated by signal SIGTERM: ${command}`,
    );
  });
});
