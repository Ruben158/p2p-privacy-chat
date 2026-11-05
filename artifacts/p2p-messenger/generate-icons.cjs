const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const lightSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bgLight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F8FBFF"/>
      <stop offset="65%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#DDF2FF"/>
    </linearGradient>
    <linearGradient id="waveLight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#BCE8FF" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#6FD0FF" stop-opacity="0.85"/>
    </linearGradient>
    <linearGradient id="logoBlue" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00AEFF"/>
      <stop offset="55%" stop-color="#0080FF"/>
      <stop offset="100%" stop-color="#0066EE"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" rx="224" fill="url(#bgLight)"/>
  <path d="M 520 1024 C 660 880, 820 860, 1024 660 L 1024 1024 Z" fill="url(#waveLight)"/>
  <rect x="16" y="16" width="992" height="992" rx="212" fill="none" stroke="#E2F0FA" stroke-width="12"/>
  <g transform="translate(512, 512) rotate(-45) translate(-512, -512)" fill="url(#logoBlue)">
    <rect x="232" y="346" width="560" height="110" rx="26"/>
    <rect x="457" y="150" width="110" height="260" rx="26"/>
    <rect x="232" y="568" width="560" height="110" rx="26"/>
    <rect x="457" y="614" width="110" height="260" rx="26"/>
  </g>
</svg>`;

const darkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bgDark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#04152D"/>
      <stop offset="60%" stop-color="#031024"/>
      <stop offset="100%" stop-color="#022B69"/>
    </linearGradient>
    <linearGradient id="waveDark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0051B8" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0077FF" stop-opacity="0.65"/>
    </linearGradient>
    <linearGradient id="neonRim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2CE0FF"/>
      <stop offset="50%" stop-color="#0088FF"/>
      <stop offset="100%" stop-color="#0055EE"/>
    </linearGradient>
    <linearGradient id="logoNeon" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0088FF"/>
      <stop offset="50%" stop-color="#19B5FE"/>
      <stop offset="100%" stop-color="#33E0FF"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" rx="224" fill="url(#bgDark)"/>
  <path d="M 520 1024 C 660 880, 820 860, 1024 660 L 1024 1024 Z" fill="url(#waveDark)"/>
  <rect x="18" y="18" width="988" height="988" rx="210" fill="none" stroke="url(#neonRim)" stroke-width="20"/>
  <g transform="translate(512, 512) rotate(-45) translate(-512, -512)" fill="url(#logoNeon)">
    <rect x="232" y="346" width="560" height="110" rx="26"/>
    <rect x="457" y="150" width="110" height="260" rx="26"/>
    <rect x="232" y="568" width="560" height="110" rx="26"/>
    <rect x="457" y="614" width="110" height="260" rx="26"/>
  </g>
</svg>`;

const outDir = path.join(__dirname, "assets", "images");
fs.mkdirSync(outDir, { recursive: true });
const lightSvgPath = path.join(outDir, "icon-light.svg");
const darkSvgPath = path.join(outDir, "icon-dark.svg");
fs.writeFileSync(lightSvgPath, lightSvg, "utf8");
fs.writeFileSync(darkSvgPath, darkSvg, "utf8");

try {
  execSync(`qlmanage -t -s 1024 -o "${outDir}" "${darkSvgPath}" "${lightSvgPath}" 2>/dev/null`);
  if (fs.existsSync(path.join(outDir, "icon-dark.svg.png"))) {
    fs.copyFileSync(path.join(outDir, "icon-dark.svg.png"), path.join(outDir, "icon.png"));
    fs.copyFileSync(path.join(outDir, "icon-dark.svg.png"), path.join(outDir, "p2p-icon.png"));
    fs.renameSync(path.join(outDir, "icon-dark.svg.png"), path.join(outDir, "icon-dark.png"));
  }
  if (fs.existsSync(path.join(outDir, "icon-light.svg.png"))) {
    fs.renameSync(path.join(outDir, "icon-light.svg.png"), path.join(outDir, "icon-light.png"));
  }
  console.log("Generated 1024x1024 PNG icons via qlmanage.");
} catch (e) {
  console.log("SVG icons written; PNG rasterization will run in CI.");
}
