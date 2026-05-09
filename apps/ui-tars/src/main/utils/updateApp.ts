import { UpdateInfo } from 'builder-util-runtime';
import { app, dialog, BrowserWindow } from 'electron';
import { logger } from '@main/logger';
import { AppUpdater as ElectronAppUpdater, autoUpdater } from 'electron-updater';

export const UPDATE_FEED_URL =
  process.env.CONTROL_UPDATE_FEED_URL ||
  'https://tomato.wutanggroup.com/auto-updates';

function isWindowsPortable(): boolean {
  return process.platform === 'win32' && 'PORTABLE_EXECUTABLE_DIR' in process.env;
}

export class AppUpdater {
  autoUpdater: ElectronAppUpdater = autoUpdater;
  private manualCheckRequested = false;

  checkReleaseName(releaseInfo: UpdateInfo): boolean {
    const releaseName = releaseInfo?.files?.[0]?.url;
    return Boolean(releaseName && /control/i.test(releaseName.toLowerCase()));
  }

  constructor(mainWindow: BrowserWindow) {
    autoUpdater.logger = logger;
    autoUpdater.autoDownload = false;

    autoUpdater.setFeedURL({
      provider: 'generic',
      url: UPDATE_FEED_URL,
    });

    autoUpdater.on('error', (error) => {
      logger.error('Update_Error', error);
      mainWindow.webContents.send('main:error', error);
      this.manualCheckRequested = false;
    });

    autoUpdater.on('update-available', (releaseInfo: UpdateInfo) => {
      logger.info('new version', releaseInfo);
      this.manualCheckRequested = false;

      if (this.checkReleaseName(releaseInfo)) {
        mainWindow.webContents.send('app-update-available', releaseInfo);
        autoUpdater.downloadUpdate();
      } else {
        logger.info('Cannot match');
      }
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
      logger.info(logMessage);
    });

    autoUpdater.on('update-downloaded', (info) => {
      logger.info('Update downloaded');
      dialog
        .showMessageBox({
          type: 'info',
          title: 'Update Ready',
          message: 'New version has been downloaded. Install now?',
          buttons: ['Install Now', 'Install Later'],
          detail: `Version ${info.version} is ready to install.`,
        })
        .then((response) => {
          if (response.response === 0) {
            autoUpdater.quitAndInstall();
          }
        });
    });

    autoUpdater.on('checking-for-update', () => {
      logger.info('Checking for updates...');
    });

    autoUpdater.on('update-not-available', (_) => {
      logger.info('No updates available.');
      if (this.manualCheckRequested) {
        this.manualCheckRequested = false;
        dialog.showMessageBox({
          type: 'info',
          title: 'Update Check',
          message: 'You are using the latest version. No updates needed.',
        });
      }
    });

    this.autoUpdater = autoUpdater;

    if (app.isPackaged) {
      this.autoUpdater.checkForUpdates();
    }
  }

  async checkForUpdatesDetail() {
    if (!app.isPackaged || isWindowsPortable()) {
      return {
        currentVersion: app.getVersion(),
        updateInfo: null,
      };
    }

    try {
      const update = await this.autoUpdater.checkForUpdates();
      const hasAvailableUpdate =
        update?.isUpdateAvailable &&
        update?.updateInfo &&
        this.checkReleaseName(update.updateInfo);

      return {
        currentVersion: this.autoUpdater.currentVersion.toString(),
        updateInfo: hasAvailableUpdate ? update?.updateInfo : null,
      };
    } catch (error) {
      logger.error('Failed to check for update:', error);
      return {
        currentVersion: app.getVersion(),
        updateInfo: null,
      };
    }
  }

  checkForUpdates() {
    this.manualCheckRequested = true;
    autoUpdater.checkForUpdates();
  }
}
