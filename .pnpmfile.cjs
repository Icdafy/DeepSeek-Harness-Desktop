"use strict";

module.exports = {
  hooks: {
    readPackage(pkg) {
      // Aqua 1.3.1 predates the runtime split and invariant removal. Align peers
      // before resolution so no retired or mixed-version Harness packages ship.
      if (pkg.name === "dsh-client-ui-aqua" && pkg.version === "1.3.1") {
        delete pkg.peerDependencies["@deepseek-ai/dsh-client-runtime"];
        delete pkg.peerDependencies["@deepseek-ai/dsh-invariants"];
        pkg.peerDependencies["@deepseek-ai/dsh-client-store"] = "0.2.1-rc.2";
        pkg.peerDependencies["@deepseek-ai/cordis"] = "~4.0.5";
        for (const name of Object.keys(pkg.peerDependencies)) {
          if (name.startsWith("@deepseek-ai/dsh-")) pkg.peerDependencies[name] = "0.2.1-rc.2";
        }
      }
      return pkg;
    },
  },
};
