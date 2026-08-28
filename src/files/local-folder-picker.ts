import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { WorkspaceError } from "@/domain/workspace/types";

const execute = promisify(execFile);
const pickerScript = String.raw`
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IShellItem {
  void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
  void GetParent(out IShellItem ppsi);
  void GetDisplayName(uint sigdnName, out IntPtr ppszName);
  void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
  void Compare(IShellItem psi, uint hint, out int piOrder);
}

[ComImport, Guid("42F85136-DB7E-439C-85F1-E4075D135FC8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IFileDialog {
  [PreserveSig] int Show(IntPtr parent);
  void SetFileTypes(uint count, IntPtr specs); void SetFileTypeIndex(uint index); void GetFileTypeIndex(out uint index);
  void Advise(IntPtr events, out uint cookie); void Unadvise(uint cookie); void SetOptions(uint options); void GetOptions(out uint options);
  void SetDefaultFolder(IShellItem folder); void SetFolder(IShellItem folder); void GetFolder(out IShellItem folder); void GetCurrentSelection(out IShellItem item);
  void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name); void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string name);
  void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title); void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string text); void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string text);
  void GetResult(out IShellItem item); void AddPlace(IShellItem item, uint placement); void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string extension);
  void Close(int result); void SetClientGuid(ref Guid guid); void ClearClientData(); void SetFilter(IntPtr filter);
}

public static class ModernFolderPicker {
  [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
  [DllImport("kernel32.dll")] private static extern IntPtr GetConsoleWindow();
  [DllImport("ole32.dll")] private static extern void CoTaskMemFree(IntPtr pv);
  private const uint FOS_PICKFOLDERS = 0x00000020;
  private const uint FOS_FORCEFILESYSTEM = 0x00000040;
  private const uint SIGDN_FILESYSPATH = 0x80058000;
  public static string Pick() {
    Type dialogType = Type.GetTypeFromCLSID(new Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7"), true);
    IFileDialog dialog = (IFileDialog)Activator.CreateInstance(dialogType);
    uint options; dialog.GetOptions(out options); dialog.SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM);
    dialog.SetTitle("Choose a local Project or Experience folder"); dialog.SetOkButtonLabel("Select folder");
    IntPtr owner = GetForegroundWindow(); if (owner == IntPtr.Zero) owner = GetConsoleWindow();
    int result = dialog.Show(owner); if (result != 0) return "";
    IShellItem item; dialog.GetResult(out item); IntPtr path; item.GetDisplayName(SIGDN_FILESYSPATH, out path);
    try { return Marshal.PtrToStringUni(path) ?? ""; } finally { if (path != IntPtr.Zero) CoTaskMemFree(path); }
  }
}
'@
[Console]::Out.Write([ModernFolderPicker]::Pick())
`;

/** Opens the Explorer-style Windows folder dialog; selected paths are never persisted. */
export async function chooseLocalEvidenceFolder(): Promise<string | undefined> {
  if (process.platform !== "win32") throw new WorkspaceError("EVIDENCE_DOCUMENTER_INVALID", "Local folder selection is available on Windows only.", "Choose a Project or Experience folder from this Windows computer.");
  try {
    const { stdout } = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-STA", "-Command", pickerScript], { timeout: 10 * 60_000, windowsHide: true, maxBuffer: 16 * 1024 });
    const folder = stdout.trim();
    return folder || undefined;
  } catch (error) {
    console.error("Explorer-style Windows folder picker failed before a folder was selected.", error);
    throw new WorkspaceError("EVIDENCE_DOCUMENTER_INVALID", "The local folder picker could not open.", "Use this app from your Windows desktop session, then choose the folder again.");
  }
}
