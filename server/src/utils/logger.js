// Minimal leveled logger that writes straight to stdout/stderr.
const COLORS = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', success: '\x1b[32m', debug: '\x1b[90m' };
const RESET = '\x1b[0m';

function write(level, args) {
  const time = new Date().toISOString().slice(11, 19);
  const text = args.map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.stack : JSON.stringify(a))).join(' ');
  const line = `${COLORS[level]}${time} ${level.toUpperCase().padEnd(7)}${RESET} ${text}\n`;
  (level === 'error' ? process.stderr : process.stdout).write(line);
}

export const logger = {
  info: (...a) => write('info', a),
  warn: (...a) => write('warn', a),
  error: (...a) => write('error', a),
  success: (...a) => write('success', a),
  debug: (...a) => process.env.DEBUG && write('debug', a),
  raw: (text) => process.stdout.write(`${text}\n`),
  // Render an array of objects as an aligned text table.
  table(rows) {
    if (!rows.length) return;
    const cols = Object.keys(rows[0]);
    const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length)));
    const line = (cells) => '│ ' + cells.map((c, i) => String(c).padEnd(widths[i])).join(' │ ') + ' │';
    const sep = (l, m, r) => l + widths.map((w) => '─'.repeat(w + 2)).join(m) + r;
    const out = [sep('┌', '┬', '┐'), line(cols), sep('├', '┼', '┤'), ...rows.map((r) => line(cols.map((c) => r[c]))), sep('└', '┴', '┘')];
    process.stdout.write(out.join('\n') + '\n');
  },
};
