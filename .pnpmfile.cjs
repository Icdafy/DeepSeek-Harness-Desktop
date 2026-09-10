"use strict";

module.exports = {
  hooks: {
    readPackage(pkg) {
      // Aqua 1.3.1 predates the upstream runtime split. Its only runtime import
      // is defineStore; the matching source/manifest patch moves it to client-store.
      if (pkg.name === "dsh-client-ui-aqua" && pkg.version === "1.3.1") {
        delete pkg.peerDependencies["@deepseek-ai/dsh-client-runtime"];
        pkg.peerDependencies["@deepseek-ai/dsh-client-store"] = "^0.1.5-rc.1";
        for (const name of Object.keys(pkg.peerDependencies)) {
          if (name.startsWith("@deepseek-ai/dsh-")) pkg.peerDependencies[name] = "^0.1.5-rc.1";
        }
      }
      return pkg;
    },
  },
};
