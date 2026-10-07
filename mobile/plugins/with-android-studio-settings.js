// Config plugin: `expo prebuild` regenerates android/ and would wipe Android Studio settings.
// Re-creates them so the project always opens ready to Run:
//  - .idea/workspace.xml with Gradle auto-reload = ALL (no manual Sync needed)
//  - local.properties with sdk.dir (machine-specific, gitignored)
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");
const os = require("os");

const WORKSPACE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="AutoImportSettings">
    <option name="autoReloadType" value="ALL" />
  </component>
</project>
`;

function findSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Android", "Sdk"),
    path.join(os.homedir(), "Library", "Android", "sdk"),
    path.join(os.homedir(), "Android", "Sdk"),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p));
}

module.exports = function withAndroidStudioSettings(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const androidDir = cfg.modRequest.platformProjectRoot;

      const ideaDir = path.join(androidDir, ".idea");
      fs.mkdirSync(ideaDir, { recursive: true });
      fs.writeFileSync(path.join(ideaDir, "workspace.xml"), WORKSPACE_XML);

      const sdk = findSdk();
      if (sdk) {
        const escaped = sdk.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
        fs.writeFileSync(path.join(androidDir, "local.properties"), `sdk.dir=${escaped}\n`);
      }
      return cfg;
    },
  ]);
};
