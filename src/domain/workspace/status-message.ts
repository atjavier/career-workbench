export type StorageProtectionMessage = {
  summary: string;
  detail: string;
  safeNextAction: string;
};

export function storageProtectionMessage(): StorageProtectionMessage {
  return {
    summary: "Your Windows OS account is the current workspace access boundary.",
    detail:
      "This personal-device MVP relies on Windows device/full-disk encryption. Application-level encryption at rest is required before using the workspace on a shared or unencrypted device.",
    safeNextAction: "Review the device's full-disk encryption before importing career data.",
  };
}
