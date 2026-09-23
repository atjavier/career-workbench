import { contextBridge, ipcRenderer } from "electron";

export interface DesktopBridge {
  isDesktop: boolean;
  platform: string;
  openExternal: (url: string) => Promise<boolean>;
  selectFolder: () => Promise<string | null>;
}

const bridge: DesktopBridge = {
  isDesktop: true,
  platform: process.platform,
  openExternal: async (url: string): Promise<boolean> => {
    return ipcRenderer.invoke("desktop:openExternal", url);
  },
  selectFolder: async (): Promise<string | null> => {
    return ipcRenderer.invoke("desktop:selectFolder");
  },
};

contextBridge.exposeInMainWorld("desktopBridge", bridge);
