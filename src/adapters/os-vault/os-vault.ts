import { Entry } from "@napi-rs/keyring";

export interface OsVault {
  put(reference: string, secret: string): Promise<void>;
  get(reference: string): Promise<string | undefined>;
  remove(reference: string): Promise<void>;
}

const service = "Personal Job Discovery Workspace / LM Studio";

/** Windows Credential Manager boundary. References are opaque UUIDs, never secrets. */
export const windowsOsVault: OsVault = {
  async put(reference, secret) { new Entry(service, reference).setPassword(secret); },
  async get(reference) { const value = new Entry(service, reference).getPassword(); return value ?? undefined; },
  async remove(reference) { new Entry(service, reference).deleteCredential(); },
};
