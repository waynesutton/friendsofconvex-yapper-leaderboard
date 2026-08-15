const [major, minor] = process.versions.node.split(".").map(Number);
const isSupported = major > 22 || (major === 22 && minor >= 13);

if (!isSupported) {
  console.error(
    [
      `This app needs Node.js 22.13 or newer; your terminal is using ${process.version}.`,
      "Node.js 24 is recommended and pinned in .nvmrc and .node-version.",
      "npm install installs app packages; it cannot switch the Node.js runtime used by this terminal.",
      "Switch Node versions, run npm install, and then run this command again.",
      "See SETUP_GUIDE.md → Part 1 for the exact steps.",
    ].join("\n"),
  );
  process.exit(1);
}
