import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { runCli, type CliIo } from '../../src/cli/main.js';

const temporaryDirectories: string[] = [];
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const builtCli = join(repositoryRoot, 'dist/cli/main.js');
const sourceText = `export function risk(flag: boolean) {
  if (flag) return 1;
  return 0;
}
`;

interface CapturedIo {
  io: CliIo;
  stdout: () => string;
  stderr: () => string;
}

async function makeProject(): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'crap4ts-cli-'));
  temporaryDirectories.push(projectRoot);
  await mkdir(join(projectRoot, 'src'));
  await writeFile(join(projectRoot, 'src/example.ts'), sourceText);
  return projectRoot;
}

async function writeConfig(
  projectRoot: string,
  config: Record<string, unknown>,
): Promise<void> {
  await writeFile(join(projectRoot, 'crap4ts.config.json'), `${JSON.stringify(config, null, 2)}\n`);
}

async function writeCoverage(
  projectRoot: string,
  path: string,
  contents: string,
): Promise<void> {
  const artifact = join(projectRoot, path);
  await mkdir(join(artifact, '..'), { recursive: true });
  await writeFile(artifact, contents);
}

function istanbulCoverage(hitCount = 1, tracked = true): string {
  return `${JSON.stringify({
    'src/example.ts': {
      statementMap: tracked
        ? {
            0: {
              start: { line: 2, column: 2 },
              end: { line: 2, column: 21 },
            },
          }
        : {},
      s: tracked ? { 0: hitCount } : {},
    },
  }, null, 2)}\n`;
}

function captureIo(): CapturedIo {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    io: {
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    },
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
  };
}

function nodeExitCommand(status: number): string {
  return `${JSON.stringify(process.execPath)} -e "process.exit(${status})"`;
}

function runProcess(
  executable: string,
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { cwd, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error !== null) {
        reject(Object.assign(error, { stdout, stderr }));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

beforeAll(async () => {
  await runProcess('pnpm', ['build'], repositoryRoot);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('runCli', () => {
  it.each([
    { threshold: 5, status: 3 },
    { threshold: 5.99, status: 3 },
    { threshold: 6, status: 0 },
    { threshold: 6.01, status: 0 },
  ])('checks unrounded CRAP against $threshold in text and JSON', async ({ threshold, status }) => {
    const projectRoot = await makeProject();
    await writeConfig(projectRoot, {
      sourceRoots: ['src'], coveragePath: 'coverage/data.json',
      coverageFormat: 'istanbul', threshold: threshold,
    });
    await writeCoverage(projectRoot, 'coverage/data.json', istanbulCoverage(0));
    for (const flags of [[], ['--json']]) {
      const output = captureIo();
      expect(await runCli(['--use-existing-coverage', ...flags], output.io, projectRoot)).toBe(status);
      if (flags.length === 0) {
        expect(output.stdout()).toContain('risk');
        expect(output.stderr().includes('CRAP_THRESHOLD_EXCEEDED')).toBe(status === 3);
      } else {
        const report = JSON.parse(output.stdout());
        expect(report.entries).toHaveLength(1);
        expect(report.entries[0].crap).toBe(6);
        expect(report.diagnostics).toHaveLength(status === 3 ? 1 : 0);
        if (status === 3) expect(report.diagnostics[0]).toMatchObject({
          code: 'CRAP_THRESHOLD_EXCEEDED', source: 'src/example.ts',
          message: `Function "risk" has CRAP 6, exceeding threshold ${threshold}`,
          range: { start: { line: 1, column: 1 } },
        });
        expect(output.stderr()).toBe('');
      }
    }
  });

  it('lets the CLI override config and propagates threshold failure through the built executable', async () => {
    const projectRoot = await makeProject();
    await writeConfig(projectRoot, {
      sourceRoots: ['src'], coveragePath: 'coverage/data.json', coverageFormat: 'istanbul', threshold: 5,
    });
    await writeCoverage(projectRoot, 'coverage/data.json', istanbulCoverage(0));
    const output = captureIo();
    expect(await runCli(['--use-existing-coverage', '--threshold', '7'], output.io, projectRoot)).toBe(0);
    await expect(runProcess(process.execPath, [builtCli, '--use-existing-coverage', '--threshold', '5', '--json'], projectRoot))
      .rejects.toMatchObject({ code: 3, stderr: '', stdout: expect.stringContaining('CRAP_THRESHOLD_EXCEEDED') });
  });

  it('does not treat missing coverage as a threshold breach', async () => {
    const projectRoot = await makeProject();
    await writeConfig(projectRoot, {
      sourceRoots: ['src'], coveragePath: 'coverage/data.json', coverageFormat: 'istanbul', threshold: 0,
    });
    await writeCoverage(projectRoot, 'coverage/data.json', istanbulCoverage(0, false));
    const output = captureIo();
    expect(await runCli(['--use-existing-coverage', '--json'], output.io, projectRoot)).toBe(0);
    expect(JSON.parse(output.stdout())).toMatchObject({
      entries: [{ crap: null }], diagnostics: [{ code: 'NO_TRACKED_COVERAGE' }],
    });
    expect(output.stdout()).not.toContain('CRAP_THRESHOLD_EXCEEDED');
  });

  it('checks only functions selected by filters and exclusions', async () => {
    const projectRoot = await makeProject();
    await writeFile(join(projectRoot, 'src/safe.ts'), sourceText);
    await writeConfig(projectRoot, {
      sourceRoots: ['src'], coveragePath: 'coverage/data.json', coverageFormat: 'istanbul', threshold: 5,
    });
    const coverage = {
      ...JSON.parse(istanbulCoverage(0)),
      ...JSON.parse(istanbulCoverage().replaceAll('src/example.ts', 'src/safe.ts')),
    };
    await writeCoverage(projectRoot, 'coverage/data.json', JSON.stringify(coverage));
    for (const flags of [['safe'], ['--exclude', '**/example.ts']]) {
      const output = captureIo();
      expect(await runCli(['--use-existing-coverage', '--json', ...flags], output.io, projectRoot)).toBe(0);
      expect(JSON.parse(output.stdout()).entries).toMatchObject([{ source: 'src/safe.ts', crap: 2 }]);
    }
    expect(await runCli(['--use-existing-coverage'], captureIo().io, projectRoot)).toBe(3);
  });

  it('combines config and CLI exclusions before analysis in text and JSON reports', async () => {
    const projectRoot = await makeProject();
    await writeFile(join(projectRoot, 'src/example.test.ts'), sourceText);
    await writeFile(join(projectRoot, 'src/example.spec.ts'), sourceText);
    await writeConfig(projectRoot, {
      sourceRoots: ['src'], exclude: ['**/*.spec.ts'],
      coveragePath: 'coverage/lcov.info', coverageFormat: 'lcov',
    });
    await writeCoverage(projectRoot, 'coverage/lcov.info', [
      'src/example.ts', join(projectRoot, 'src/example.test.ts'),
      'src/example.spec.ts', 'src/unrelated.ts',
    ].map((source) => `SF:${source}\nDA:2,1\nend_of_record`).join('\n'));

    const json = captureIo();
    expect(await runCli(['--use-existing-coverage', '--exclude', '**/*.test.ts', '--json'], json.io, projectRoot)).toBe(0);
    const built = await runProcess(process.execPath, [builtCli, '--use-existing-coverage', '--exclude', '**/*.test.ts', '--json'], projectRoot);
    expect(JSON.parse(built.stdout)).toEqual(JSON.parse(json.stdout()));
    const report = JSON.parse(json.stdout());
    expect(report.entries.map((entry: { source: string }) => entry.source)).toEqual(['src/example.ts']);
    expect(report.diagnostics.map((diagnostic: { source: string }) => diagnostic.source)).toEqual(['src/unrelated.ts']);
    const text = captureIo();
    expect(await runCli(['--use-existing-coverage', '--exclude', '**/*.test.ts'], text.io, projectRoot)).toBe(0);
    expect(text.stdout()).toContain('src/example');
    expect(text.stdout()).not.toContain('.test');
    expect(text.stdout()).not.toContain('.spec');
    expect(text.stderr()).not.toContain('example.test');
    expect(text.stderr()).toContain('src/unrelated.ts');
  });

  it('uses terminal colour, --no-color, and NO_COLOR while leaving JSON unchanged', async () => {
    vi.stubEnv('NO_COLOR', undefined);
    vi.stubEnv('TERM', 'xterm-256color');
    const projectRoot = await makeProject();
    await writeConfig(projectRoot, { sourceRoots: ['src'], coveragePath: 'coverage/data.json', coverageFormat: 'istanbul' });
    await writeCoverage(projectRoot, 'coverage/data.json', istanbulCoverage());
    const output = captureIo();
    const terminal = { ...output.io, isTTY: true, columns: 80 };
    expect(await runCli(['--use-existing-coverage'], terminal, projectRoot)).toBe(0);
    expect(output.stdout()).toContain('\u001b[32m');
    const plain = captureIo();
    expect(await runCli(['--use-existing-coverage', '--no-color'], { ...plain.io, isTTY: true }, projectRoot)).toBe(0);
    expect(plain.stdout()).not.toContain('\u001b[');
    vi.stubEnv('NO_COLOR', '1');
    const env = captureIo();
    expect(await runCli(['--use-existing-coverage'], { ...env.io, isTTY: true }, projectRoot)).toBe(0);
    expect(env.stdout()).not.toContain('\u001b[');
    const json = captureIo();
    expect(await runCli(['--use-existing-coverage', '--json', '--no-color'], { ...json.io, isTTY: true }, projectRoot)).toBe(0);
    expect(JSON.parse(json.stdout())).toHaveProperty('entries');
    expect(json.stdout()).not.toContain('\u001b[');
    const redirected = await runProcess(process.execPath, [builtCli, '--use-existing-coverage'], projectRoot);
    expect(redirected.stdout).not.toContain('\u001b[');
    expect(redirected.stdout).toContain('| Function');
  });

  it('runs the built entry point when Node receives a symlink path', async () => {
    const projectRoot = await makeProject();
    const linkedCli = join(projectRoot, 'linked-crap4ts.mjs');
    await symlink(builtCli, linkedCli, 'file');

    const result = await runProcess(process.execPath, [linkedCli, '--help'], projectRoot);

    expect(result.stdout).toContain('Usage: crap4ts [filters...] [options]');
    expect(result.stderr).toBe('');
  });

  it('prints usage and returns zero for --help', async () => {
    const projectRoot = await makeProject();
    const output = captureIo();

    const status = await runCli(['--help'], output.io, projectRoot);

    expect(status).toBe(0);
    expect(output.stdout()).toContain('Usage: crap4ts [filters...] [options]');
    expect(output.stdout()).toContain('--use-existing-coverage');
    expect(output.stderr()).toBe('');
  });

  it('analyzes existing Istanbul coverage as text', async () => {
    const projectRoot = await makeProject();
    const output = captureIo();
    await writeConfig(projectRoot, {
      sourceRoots: ['src'],
      coveragePath: 'coverage/coverage-final.json',
      coverageFormat: 'istanbul',
    });
    await writeCoverage(projectRoot, 'coverage/coverage-final.json', istanbulCoverage());

    const status = await runCli(['--use-existing-coverage'], output.io, projectRoot);

    expect(status).toBe(0);
    expect(output.stdout()).toContain('CRAP Report\n===========');
    expect(output.stdout()).toContain('risk');
    expect(output.stdout()).toContain('100.0%');
    expect(output.stderr()).toBe('');
  });

  it('analyzes existing LCOV coverage as JSON without changing the artifact', async () => {
    const projectRoot = await makeProject();
    const output = captureIo();
    const artifact = 'SF:src/example.ts\nDA:2,1\nDA:3,0\nend_of_record\n';
    await writeConfig(projectRoot, {
      sourceRoots: ['src'],
      coveragePath: 'coverage/lcov.info',
      coverageFormat: 'lcov',
    });
    await writeCoverage(projectRoot, 'coverage/lcov.info', artifact);

    const status = await runCli(
      ['--use-existing-coverage', '--json'],
      output.io,
      projectRoot,
    );

    expect(status).toBe(0);
    expect(JSON.parse(output.stdout())).toMatchObject({
      coverage: { format: 'lcov', kind: 'line', path: 'coverage/lcov.info' },
      entries: [{
        name: 'risk',
        start: { line: 1, column: 1 },
        end: { line: 4, column: 2 },
        coverage: 50,
        coverageKind: 'line',
      }],
      diagnostics: [],
    });
    expect(JSON.parse(output.stdout()).entries[0]).not.toHaveProperty('range');
    await expect(readFile(join(projectRoot, 'coverage/lcov.info'), 'utf8')).resolves.toBe(artifact);
    expect(output.stderr()).toBe('');
  });

  it('deletes a stale artifact before a generated coverage command and analyzes the new artifact', async () => {
    const projectRoot = await makeProject();
    const output = captureIo();
    const generatedCoverage = istanbulCoverage(0);
    const generator = `import { access, mkdir, writeFile } from 'node:fs/promises';
try {
  await access('coverage/coverage-final.json');
  process.exit(9);
} catch (error) {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
}
await mkdir('coverage', { recursive: true });
await writeFile('coverage/coverage-final.json', ${JSON.stringify(generatedCoverage)});
`;
    await writeFile(join(projectRoot, 'generate-coverage.mjs'), generator);
    await writeConfig(projectRoot, {
      sourceRoots: ['src'],
      coverageCommand: 'node generate-coverage.mjs',
      coveragePath: 'coverage/coverage-final.json',
      coverageFormat: 'istanbul',
      threshold: 5,
    });
    await writeCoverage(projectRoot, 'coverage/coverage-final.json', 'stale artifact\n');

    const status = await runCli([], output.io, projectRoot);

    expect(status).toBe(3);
    await expect(readFile(join(projectRoot, 'coverage/coverage-final.json'), 'utf8')).resolves.toBe(
      generatedCoverage,
    );
    expect(output.stdout()).toContain('0.0%');
    expect(output.stderr()).toContain('CRAP_THRESHOLD_EXCEEDED');
  });

  it('keeps generated JSON stdout parseable when the coverage command writes to stdout', async () => {
    const projectRoot = await makeProject();
    const generatedCoverage = istanbulCoverage();
    await writeFile(join(projectRoot, 'generate-coverage.mjs'), `import { mkdir, writeFile } from 'node:fs/promises';
console.log('coverage command chatter');
await mkdir('coverage', { recursive: true });
await writeFile('coverage/coverage-final.json', ${JSON.stringify(generatedCoverage)});
`);
    await writeConfig(projectRoot, {
      sourceRoots: ['src'],
      coverageCommand: 'node generate-coverage.mjs',
      coveragePath: 'coverage/coverage-final.json',
      coverageFormat: 'istanbul',
    });

    const result = await runProcess(process.execPath, [builtCli, '--json'], projectRoot);

    expect(JSON.parse(result.stdout)).toMatchObject({
      entries: [{ name: 'risk' }],
    });
    expect(result.stdout).not.toContain('coverage command chatter');
    expect(result.stderr).toContain('coverage command chatter');
  });

  it('returns one when the coverage command fails', async () => {
    const projectRoot = await makeProject();
    const output = captureIo();
    await writeConfig(projectRoot, {
      sourceRoots: ['src'],
      coverageCommand: nodeExitCommand(7),
      coveragePath: 'coverage/coverage-final.json',
      coverageFormat: 'istanbul',
    });

    const status = await runCli([], output.io, projectRoot);

    expect(status).toBe(1);
    expect(output.stdout()).toBe('');
    expect(output.stderr()).toContain('Coverage command failed with status 7');
  });

  it('returns one with a clean parser error for an SF-tagged line without a colon', async () => {
    const projectRoot = await makeProject();
    const output = captureIo();
    await writeConfig(projectRoot, {
      sourceRoots: ['src'],
      coveragePath: 'coverage/lcov.info',
      coverageFormat: 'lcov',
    });
    await writeCoverage(projectRoot, 'coverage/lcov.info', [
      'SF=src/example.ts',
      'DA:2,1',
      'end_of_record',
    ].join('\n'));

    const status = await runCli(['--use-existing-coverage'], output.io, projectRoot);

    expect(status).toBe(1);
    expect(output.stdout()).toBe('');
    expect(output.stderr()).toBe('Error: line 1: SF record must begin with SF:\n');
  });

  it.each([
    { name: 'invalid arguments', argv: ['--unknown'], config: undefined },
    { name: 'invalid configuration', argv: [], config: { sourceRoots: [] } },
  ])('returns two for $name', async ({ argv, config }) => {
    const projectRoot = await makeProject();
    const output = captureIo();
    if (config !== undefined) await writeConfig(projectRoot, config);

    const status = await runCli(argv, output.io, projectRoot);

    expect(status).toBe(2);
    expect(output.stdout()).toBe('');
    expect(output.stderr()).not.toBe('');
  });

  it('returns zero for N/A entries and writes mapping diagnostics to text stderr', async () => {
    const projectRoot = await makeProject();
    const output = captureIo();
    await writeConfig(projectRoot, {
      sourceRoots: ['src'],
      coveragePath: 'coverage/coverage-final.json',
      coverageFormat: 'istanbul',
    });
    await writeCoverage(projectRoot, 'coverage/coverage-final.json', istanbulCoverage(0, false));

    const status = await runCli(['--use-existing-coverage'], output.io, projectRoot);

    expect(status).toBe(0);
    expect(output.stdout()).toContain('N/A');
    expect(output.stderr()).toContain('NO_TRACKED_COVERAGE');
    expect(output.stderr()).toContain('Function "risk" has no tracked statement coverage locations');
  });

  it('returns two with a clean error when a configured source root does not exist', async () => {
    const projectRoot = await makeProject();
    const output = captureIo();
    await writeConfig(projectRoot, {
      sourceRoots: ['missing-src'],
      coveragePath: 'coverage/coverage-final.json',
      coverageFormat: 'istanbul',
    });
    await writeCoverage(projectRoot, 'coverage/coverage-final.json', istanbulCoverage());

    const status = await runCli(['--use-existing-coverage'], output.io, projectRoot);

    expect(status).toBe(2);
    expect(output.stdout()).toBe('');
    expect(output.stderr()).toBe('Error: Could not resolve source root: missing-src\n');
  });

  it('returns one with a clean error for an operational source-root resolution failure', async () => {
    const projectRoot = await makeProject();
    const output = captureIo();
    await symlink('source-loop', join(projectRoot, 'source-loop'), 'dir');
    await writeConfig(projectRoot, {
      sourceRoots: ['source-loop'],
      coveragePath: 'coverage/coverage-final.json',
      coverageFormat: 'istanbul',
    });
    await writeCoverage(projectRoot, 'coverage/coverage-final.json', istanbulCoverage());

    const status = await runCli(['--use-existing-coverage'], output.io, projectRoot);

    expect(status).toBe(1);
    expect(output.stdout()).toBe('');
    expect(output.stderr()).toBe('Error: Could not resolve source root: source-loop\n');
  });

  it('returns one with a clean error when coverage artifact cleanup cannot remove a directory', async () => {
    const projectRoot = await makeProject();
    const output = captureIo();
    await mkdir(join(projectRoot, 'coverage-artifact'));
    await writeConfig(projectRoot, {
      sourceRoots: ['src'],
      coverageCommand: nodeExitCommand(0),
      coveragePath: 'coverage-artifact',
      coverageFormat: 'istanbul',
    });

    const status = await runCli([], output.io, projectRoot);

    expect(status).toBe(1);
    expect(output.stdout()).toBe('');
    expect(output.stderr()).toBe('Error: Could not remove coverage artifact: coverage-artifact\n');
  });

  it('writes exactly one JSON object to stdout and keeps diagnostic prose inside it', async () => {
    const projectRoot = await makeProject();
    const output = captureIo();
    await writeConfig(projectRoot, {
      sourceRoots: ['src'],
      coveragePath: 'coverage/coverage-final.json',
      coverageFormat: 'istanbul',
    });
    await writeCoverage(projectRoot, 'coverage/coverage-final.json', istanbulCoverage(0, false));

    const status = await runCli(
      ['--use-existing-coverage', '--json'],
      output.io,
      projectRoot,
    );

    expect(status).toBe(0);
    expect(output.stdout().startsWith('{\n')).toBe(true);
    expect(output.stdout().endsWith('}\n')).toBe(true);
    expect(JSON.parse(output.stdout())).toMatchObject({
      entries: [{ name: 'risk', coverage: null, crap: null }],
      diagnostics: [{ code: 'NO_TRACKED_COVERAGE' }],
    });
    expect(output.stderr()).toBe('');
  });
});
