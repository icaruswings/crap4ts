import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, readlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../..');
const scriptPath = join(projectRoot, 'scripts/link-skill.sh');

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function runLinkScript(home: string): Promise<RunResult> {
  return new Promise((resolveRun, reject) => {
    const child = spawn('bash', [scriptPath], {
      cwd: projectRoot,
      env: { ...process.env, HOME: home },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolveRun({ status: status ?? -1, stdout, stderr }));
  });
}

describe('link-skill.sh', () => {
  it('links the checkout for Codex and Claude Code and can run again', async () => {
    const home = await mkdtemp(join(tmpdir(), 'crap4ts-link-skill-'));

    expect((await runLinkScript(home)).status).toBe(0);
    expect((await runLinkScript(home)).status).toBe(0);

    await expect(readlink(join(home, '.agents/skills/crap4ts'))).resolves.toBe(projectRoot);
    await expect(readlink(join(home, '.claude/skills/crap4ts'))).resolves.toBe(projectRoot);
  });

  it('refuses a real skill directory before creating either link', async () => {
    const home = await mkdtemp(join(tmpdir(), 'crap4ts-link-skill-'));
    const existingTarget = join(home, '.agents/skills/crap4ts');
    const sentinel = join(existingTarget, 'keep.txt');
    await mkdir(existingTarget, { recursive: true });
    await writeFile(sentinel, 'keep\n');

    const result = await runLinkScript(home);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('refusing to replace a real directory');
    await expect(readFile(sentinel, 'utf8')).resolves.toBe('keep\n');
    await expect(access(join(home, '.claude/skills/crap4ts'))).rejects.toThrow();
  });
});
