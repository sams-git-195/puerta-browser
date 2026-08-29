import type { StaticDomainInfo } from "./types";

export const STATIC_DOMAINS: StaticDomainInfo[] = [
  // puerta-internal
  {
    protocol: "puerta-internal",
    hostname: "main-ui",
    actual: {
      type: "route",
      route: "main-ui"
    }
  },
  {
    protocol: "puerta-internal",
    hostname: "popup-ui",
    actual: {
      type: "route",
      route: "popup-ui"
    }
  },
  {
    protocol: "puerta-internal",
    hostname: "settings",
    actual: {
      type: "route",
      route: "settings"
    }
  },
  {
    protocol: "puerta-internal",
    hostname: "omnibox",
    actual: {
      type: "route",
      route: "omnibox"
    }
  },
  {
    protocol: "puerta-internal",
    hostname: "onboarding",
    actual: {
      type: "route",
      route: "onboarding"
    }
  },

  // puerta
  {
    protocol: "puerta",
    hostname: "new-tab",
    actual: {
      type: "route",
      route: "new-tab"
    }
  },
  {
    protocol: "puerta",
    hostname: "error",
    actual: {
      type: "route",
      route: "error"
    }
  },
  {
    protocol: "puerta",
    hostname: "about",
    actual: {
      type: "route",
      route: "about"
    }
  },
  {
    protocol: "puerta",
    hostname: "games",
    actual: {
      type: "route",
      route: "games"
    }
  },
  {
    protocol: "puerta",
    hostname: "omnibox",
    actual: {
      type: "route",
      route: "omnibox-debug"
    }
  },
  {
    protocol: "puerta",
    hostname: "extensions",
    actual: {
      type: "route",
      route: "extensions"
    }
  },
  {
    protocol: "puerta",
    hostname: "history",
    actual: {
      type: "route",
      route: "history"
    }
  },
  {
    protocol: "puerta",
    hostname: "bangs",
    actual: {
      type: "route",
      route: "bangs"
    }
  },
  {
    protocol: "puerta",
    hostname: "pdf-viewer",
    actual: {
      type: "route",
      route: "pdf-viewer"
    }
  },

  // puerta-external
  {
    protocol: "puerta-external",
    // Dino Game - Taken from https://github.com/yell0wsuit/chrome-dino-enhanced
    hostname: "dino.chrome.game",
    actual: {
      type: "subdirectory",
      subdirectory: "chrome-dino-game"
    }
  },
  {
    protocol: "puerta-external",
    // Surf Game (v1) - Taken From https://github.com/yell0wsuit/ms-edge-letssurf
    hostname: "v1.surf.edge.game",
    actual: {
      type: "subdirectory",
      subdirectory: "edge-surf-game-v1"
    }
  },
  {
    protocol: "puerta-external",
    // Surf Game (v2) - Taken from https://github.com/yell0wsuit/ms-edge-surf-2
    hostname: "v2.surf.edge.game",
    actual: {
      type: "subdirectory",
      subdirectory: "edge-surf-game-v2"
    }
  }
];
