import { defineConfig } from "vite";
import legacy from "@vitejs/plugin-legacy";
import MagicString from "magic-string";

const phaserVibrationAssignment =
  "navigator.vibrate = navigator.vibrate || navigator.webkitVibrate || navigator.mozVibrate || navigator.msVibrate;";
const phaserVibrationCheck = /if \(navigator\.vibrate\)\r?\n    \{\r?\n        Features\.vibration = true;/;

// Phaser 3 writes to navigator.vibrate while detecting device features. On
// iOS this property can be read-only, which aborts the entire module import.
const phaserReadonlyVibrateFix = {
  name: "phaser-readonly-vibrate-fix",
  transform(code: string, id: string) {
    if (!id.replaceAll("\\", "/").endsWith("/phaser/dist/phaser.js")) return;
    const assignmentAt = code.indexOf(phaserVibrationAssignment);
    const check = phaserVibrationCheck.exec(code);
    if (assignmentAt < 0 || !check) {
      throw new Error("Phaser vibration detection changed; update the iOS compatibility fix");
    }

    const patched = new MagicString(code);
    patched.overwrite(assignmentAt, assignmentAt + phaserVibrationAssignment.length,
      "var detectedVibrate = navigator.vibrate || navigator.webkitVibrate || navigator.mozVibrate || navigator.msVibrate;");
    patched.overwrite(check.index, check.index + check[0].length,
      check[0].replace("navigator.vibrate", "detectedVibrate"));
    return { code: patched.toString(), map: patched.generateMap({ hires: true }) };
  },
};

export default defineConfig({
  base: "./",
  build: { sourcemap: "hidden", rollupOptions: { input: "dev.html" } },
  plugins: [phaserReadonlyVibrateFix, legacy({ targets: ["defaults", "ChromeAndroid >= 70", "not IE 11"] }), {
    name: "local-dev-entry",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url === "/") request.url = "/dev.html";
        next();
      });
    },
  }],
});
