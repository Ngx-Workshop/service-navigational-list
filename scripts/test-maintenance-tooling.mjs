import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const fixtures = [];
const environment = {
  ...process.env,
  CI: '',
  HUSKY: '',
  NODE_ENV: '',
  npm_config_omit: '',
};

function fixture() {
  const path = mkdtempSync(join(tmpdir(), 'menu-maintenance-'));
  fixtures.push(path);
  for (const file of ['package.json', 'package-lock.json']) {
    cpSync(join(root, file), join(path, file));
  }
  return path;
}

function run(path, command, args, env = environment) {
  return execFileSync(command, args, {
    cwd: path,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

test(
  'maintenance installs and real Git hooks',
  { timeout: 180000 },
  async (t) => {
    try {
      await t.test(
        'developer install, staged formatting, partial staging and hook failures',
        () => {
          const path = fixture();
          for (const file of [
            '.husky',
            '.prettierrc',
            '.prettierignore',
            '.lintstagedrc.json',
          ]) {
            if (file === '.husky') {
              mkdirSync(join(path, file));
              cpSync(
                join(root, file, 'pre-commit'),
                join(path, file, 'pre-commit')
              );
            } else cpSync(join(root, file), join(path, file));
          }
          run(path, 'git', ['init', '-q']);
          run(path, 'git', ['config', 'user.name', 'Maintenance Fixture']);
          run(path, 'git', ['config', 'user.email', 'fixture@example.invalid']);
          run(path, 'git', ['config', 'commit.gpgsign', 'false']);
          run(path, 'npm', ['ci', '--no-audit', '--no-fund']);
          assert.equal(
            run(path, 'git', ['config', '--get', 'core.hooksPath']).trim(),
            '.husky/_'
          );
          assert.ok(existsSync(join(path, '.husky/_/pre-commit')));
          writeFileSync(join(path, '.gitignore'), 'node_modules/\n.husky/_/\n');
          mkdirSync(join(path, 'src'));
          writeFileSync(
            join(path, 'src/probe.ts'),
            'const staged = 1;\n\nconst unstaged = 2;\n'
          );
          run(path, 'git', ['add', '.']);
          run(path, 'git', ['commit', '-qm', 'fixture baseline']);
          writeFileSync(
            join(path, 'src/probe.ts'),
            'const staged=3;\n\nconst unstaged = 2;\n'
          );
          run(path, 'git', ['add', 'src/probe.ts']);
          writeFileSync(
            join(path, 'src/probe.ts'),
            'const staged=3;\n\nconst unstaged = 4;\n'
          );
          writeFileSync(join(path, 'unstaged.txt'), 'keep untracked content\n');
          run(path, 'git', ['commit', '-qm', 'partially staged formatting']);
          assert.equal(
            run(path, 'git', ['show', 'HEAD:src/probe.ts']),
            'const staged = 3;\n\nconst unstaged = 2;\n'
          );
          assert.equal(
            readFileSync(join(path, 'src/probe.ts'), 'utf8'),
            'const staged = 3;\n\nconst unstaged = 4;\n'
          );
          assert.equal(
            readFileSync(join(path, 'unstaged.txt'), 'utf8'),
            'keep untracked content\n'
          );
          const head = run(path, 'git', ['rev-parse', 'HEAD']);
          writeFileSync(join(path, 'src/broken.ts'), 'const broken = ;\n');
          run(path, 'git', ['add', 'src/broken.ts']);
          const failed = spawnSync('git', ['commit', '-qm', 'must fail'], {
            cwd: path,
            env: environment,
          });
          assert.notEqual(failed.status, 0);
          assert.equal(run(path, 'git', ['rev-parse', 'HEAD']), head);
          assert.equal(
            run(path, 'git', ['show', ':src/broken.ts']),
            'const broken = ;\n'
          );
          run(path, 'git', ['config', '--unset', 'core.hooksPath']);
          for (const overrides of [{ CI: 'true' }, { HUSKY: '0' }]) {
            run(path, 'npm', ['run', 'prepare'], {
              ...environment,
              ...overrides,
            });
            assert.notEqual(
              spawnSync('git', ['config', '--get', 'core.hooksPath'], {
                cwd: path,
              }).status,
              0
            );
          }

          // Exercise the actual non-mutating package script, not a standalone proxy.
          run(path, 'git', ['reset', '-q', '--', 'src/broken.ts']);
          rmSync(join(path, 'src/broken.ts'));
          for (const file of [
            'eslint.config.mjs',
            '.github/workflows/validate.yml',
            'scripts/test-maintenance-tooling.mjs',
          ]) {
            mkdirSync(resolve(path, file, '..'), { recursive: true });
            cpSync(join(root, file), join(path, file));
          }
          mkdirSync(join(path, 'test'));
          writeFileSync(join(path, 'test/probe.ts'), 'export {};\n');
          writeFileSync(join(path, 'src/probe.ts'), 'const violation=1;\n');
          const before = readFileSync(join(path, 'src/probe.ts'), 'utf8');
          const check = spawnSync('npm', ['run', 'format:check'], {
            cwd: path,
            env: { ...environment, CI: 'true' },
          });
          assert.notEqual(check.status, 0);
          assert.match(String(check.stdout), /Checking formatting/);
          assert.match(String(check.stderr), /src\/probe.ts/);
          assert.equal(
            readFileSync(join(path, 'src/probe.ts'), 'utf8'),
            before
          );
          writeFileSync(join(path, 'src/probe.ts'), 'const violation = 1;\n');
          run(path, 'npm', ['run', 'format:check']);
        }
      );

      for (const [name, env] of [
        ['CI without Git', { ...environment, CI: 'true' }],
        ['Docker-style package-only without Git', environment],
        [
          'production without devDependencies',
          { ...environment, NODE_ENV: 'production' },
        ],
      ]) {
        await t.test(name, () => {
          const path = fixture();
          const args = ['ci', '--no-audit', '--no-fund'];
          if (name.startsWith('production')) {
            args.push('--omit=dev');
            run(path, 'git', ['init', '-q']);
            mkdirSync(join(path, '.husky'));
            cpSync(
              join(root, '.husky/pre-commit'),
              join(path, '.husky/pre-commit')
            );
          }
          run(path, 'npm', args, env);
          assert.ok(existsSync(join(path, 'node_modules/@nestjs/core')));
          assert.equal(existsSync(join(path, '.husky/_')), false);
          if (name.startsWith('production'))
            assert.equal(existsSync(join(path, 'node_modules/husky')), false);
        });
      }
    } finally {
      for (const path of fixtures)
        rmSync(path, { recursive: true, force: true });
    }
  }
);
