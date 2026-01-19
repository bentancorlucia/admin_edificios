'use client';

import { useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ask } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export function Updater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [newVersion, setNewVersion] = useState('');

  useEffect(() => {
    checkForUpdates();
  }, []);

  async function checkForUpdates() {
    try {
      const update = await check();
      if (update) {
        setUpdateAvailable(true);
        setNewVersion(update.version);
      }
    } catch (error) {
      console.error('Error al verificar actualizaciones:', error);
    }
  }

  async function downloadAndInstall() {
    try {
      const update = await check();
      if (!update) return;

      const confirmed = await ask(
        `¿Deseas instalar la versión ${update.version}? La aplicación se reiniciará.`,
        {
          title: 'Actualización disponible',
          kind: 'info',
          okLabel: 'Instalar',
          cancelLabel: 'Más tarde',
        }
      );

      if (!confirmed) return;

      setIsDownloading(true);
      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setDownloadProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            setDownloadProgress(100);
            break;
        }
      });

      await relaunch();
    } catch (error) {
      console.error('Error al descargar actualización:', error);
      setIsDownloading(false);
    }
  }

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        onClick={downloadAndInstall}
        disabled={isDownloading}
        className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
      >
        <Download className="mr-2 h-4 w-4" />
        {isDownloading
          ? `Descargando... ${downloadProgress}%`
          : `Actualizar a v${newVersion}`}
      </Button>
    </div>
  );
}
