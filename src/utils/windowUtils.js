const { getCurrentWindow } = window.__TAURI__.window;

export async function resizeWindow(width, height) {
  const appWindow = await getCurrentWindow();
  await appWindow.setSize({ type: 'Logical', width, height });
}

export async function centerWindow() {
  const appWindow = await getCurrentWindow();
  await appWindow.center();
} 