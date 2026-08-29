import { registerFlowProtocol } from "./_protocols/puerta";
import { registerFlowInternalProtocol } from "./_protocols/puerta-internal";
import { registerFlowExternalProtocol } from "./_protocols/puerta-external";
import { protocol, Session } from "electron";
import type { CustomProtocol } from "./types";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "puerta",
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: false,
      allowServiceWorkers: false,
      supportFetchAPI: false,
      corsEnabled: true,
      stream: false,
      codeCache: true
    }
  },
  {
    scheme: "puerta-internal",
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: false,
      allowServiceWorkers: false,
      supportFetchAPI: false,
      corsEnabled: true,
      stream: false,
      codeCache: true
    }
  },
  {
    scheme: "puerta-external",
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: false,
      allowServiceWorkers: false,
      supportFetchAPI: false,
      corsEnabled: true,
      stream: true,
      codeCache: true
    }
  }
]);

// Register protocols for normal sessions
export function registerProtocolsWithSession(session: Session, protocols: CustomProtocol[]) {
  const protocol = session.protocol;

  if (protocols.includes("puerta")) {
    registerFlowProtocol(protocol);
  }
  if (protocols.includes("puerta-internal")) {
    registerFlowInternalProtocol(protocol);
  }
  if (protocols.includes("puerta-external")) {
    registerFlowExternalProtocol(protocol);
  }
}
