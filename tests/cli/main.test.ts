import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli, type CliIo } from '../../src/cli/main.js';

const temporaryDirectories: string[] = [];
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

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('runCli', () => {
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
      entries: [{ name: 'risk', coverage: 50, coverageKind: 'line' }],
      diagnostics: [],
    });
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
    });
    await writeCoverage(projectRoot, 'coverage/coverage-final.json', 'stale artifact\n');

    const status = await runCli([], output.io, projectRoot);

    expect(status).toBe(0);
    await expect(readFile(join(projectRoot, 'coverage/coverage-final.json'), 'utf8')).resolves.toBe(
      generatedCoverage,
    );
    expect(output.stdout()).toContain('0.0%');
    expect(output.stderr()).toBe('');
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
