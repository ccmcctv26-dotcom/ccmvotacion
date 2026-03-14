const { app, BrowserWindow } = require('electron');
const path = require('path');
// process.env.NODE_ENV = process.env.NODE_ENV || 'development';
// console.log('NODE_ENV:', process.env.NODE_ENV);

let mainWindow;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  // Load the app
  // When running in development (not packaged), load Vite dev server.
  // When packaged, load the built `dist/index.html`.
  if (!app.isPackaged) {
    mainWindow.loadURL('http://127.0.0.1:3000'); // Vite dev server
    // mainWindow.webContents.openDevTools(); // Commented out to avoid devtools errors
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    mainWindow.webContents.openDevTools(); // Commented out to avoid devtools errors
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});