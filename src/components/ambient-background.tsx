"use client";

const CODE_LINES = [
  "const channel = await join('#general')",
  "git commit -m \"ship the vibes\"",
  "fn notify(user: &str) { … }",
  "SELECT * FROM messages WHERE …",
  "export async function sendDM() {",
  "// TODO: celebrate the merge",
  "interface Thread { id: string }",
  "npm run build && vercel --prod",
  "if (mentioned) ping(user)",
  "type Banter = 'channels' | 'dms'",
];

export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="banter-fluid banter-fluid-a" />
      <div className="banter-fluid banter-fluid-b" />
      <div className="banter-fluid banter-fluid-c" />
      <div className="banter-grid" />
      <div className="banter-code-layer">
        {CODE_LINES.map((line, i) => (
          <span
            key={line}
            className="banter-code-line"
            style={{
              top: `${8 + ((i * 11) % 84)}%`,
              left: `${(i % 2 === 0 ? 4 : 52) + (i % 3) * 3}%`,
              animationDelay: `${i * 0.7}s`,
            }}
          >
            {line}
          </span>
        ))}
      </div>
      <div className="banter-noise" />
    </div>
  );
}
