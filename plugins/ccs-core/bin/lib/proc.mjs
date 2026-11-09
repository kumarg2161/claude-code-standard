// Child-process helper with timeout escalation (SIGINT -> SIGTERM -> SIGKILL) and group kill,
// so test runners and dev servers spawned by an agent die with it.
import { spawn } from 'node:child_process';

const live = new Set();
export function killAll(sig = 'SIGTERM') {
  for (const p of live) { try { process.kill(-p.pid, sig); } catch { try { p.kill(sig); } catch { /* gone */ } } }
}

export function run(cmd, args, { cwd, input, timeoutMs = 0, env, graceMs = 30000 } = {}) {
  return new Promise(resolve => {
    const t0 = Date.now();
    let out = '', err = '', timedOut = false, done = false;
    const child = spawn(cmd, args, { cwd, env: env ? { ...process.env, ...env } : process.env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    live.add(child);
    const sig = s => { try { process.kill(-child.pid, s); } catch { try { child.kill(s); } catch { /* gone */ } } };
    const timers = [];
    if (timeoutMs > 0) timers.push(setTimeout(() => {
      timedOut = true; sig('SIGINT');
      timers.push(setTimeout(() => { sig('SIGTERM'); timers.push(setTimeout(() => sig('SIGKILL'), 10000)); }, graceMs));
    }, timeoutMs));
    child.stdout.on('data', d => { out += d; if (out.length > 8e6) out = out.slice(-4e6); });
    child.stderr.on('data', d => { err += d; if (err.length > 2e6) err = err.slice(-1e6); });
    const finish = (code, signal, spawnErr) => {
      if (done) return; done = true; timers.forEach(clearTimeout); live.delete(child);
      resolve({ code: code ?? (signal ? 128 : 1), signal, stdout: out, stderr: spawnErr ? `${err}\n${spawnErr.message}` : err, timedOut, durationMs: Date.now() - t0, spawnError: !!spawnErr });
    };
    child.on('error', e => finish(127, null, e));
    child.on('close', (code, signal) => finish(code, signal));
    if (input != null) child.stdin.on('error', () => {}).end(input); else child.stdin.end();
  });
}

export const tail = (s, n = 40) => String(s || '').split('\n').slice(-n).join('\n').trim();
