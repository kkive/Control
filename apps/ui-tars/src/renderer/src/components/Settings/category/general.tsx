import { useEffect, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/renderer/src/api';
import { Button } from '@renderer/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog';

const APP_DOWNLOAD_URL = 'https://tomato.wutanggroup.com/';

export const GeneralSettings = () => {
  const [updateLoading, setUpdateLoading] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('-');
  const [updateDetail, setUpdateDetail] = useState<{
    version: string;
  } | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadVersion = async () => {
      try {
        const version = await api.getAppVersion();
        if (mounted) {
          setCurrentVersion(version);
        }
      } catch (error) {
        console.error('Failed to get app version:', error);
      }
    };

    void loadVersion();

    return () => {
      mounted = false;
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setUpdateLoading(true);
    setUpdateDetail(null);
    try {
      const detail = await api.checkForUpdatesDetail();
      setCurrentVersion(detail.currentVersion);

      if (detail.updateInfo) {
        setUpdateDetail({
          version: detail.updateInfo.version,
        });
        setUpdateDialogOpen(true);
        return;
      }

      if (!detail.isPackaged) {
        toast.info('Unpackaged version does not support update check!');
      } else {
        toast.success('No update available', {
          description: `Current version: ${detail.currentVersion} is the latest version`,
          position: 'top-right',
          richColors: true,
        });
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setUpdateLoading(false);
    }
  };

  return (
    <>
      <div className="text-sm text-gray-500 mb-2">{`当前版本: v${currentVersion}`}</div>
      <Button
        variant="outline"
        type="button"
        disabled={updateLoading}
        onClick={handleCheckForUpdates}
      >
        <RefreshCcw
          className={`h-4 w-4 mr-2 ${updateLoading ? 'animate-spin' : ''}`}
        />
        {updateLoading ? '正在检查' : '检查更新'}
      </Button>
      {updateDetail?.version && (
        <div className="text-sm text-gray-500">
          {`New version available: v${updateDetail.version}`}
        </div>
      )}

      <AlertDialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>有新版本</AlertDialogTitle>
            <AlertDialogDescription>
              {`检测到最新版本: v${updateDetail?.version ?? '-'}。 点击“下载”以安装最新软件包。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>之后</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                window.open(APP_DOWNLOAD_URL, '_blank', 'noopener,noreferrer')
              }
            >
              下载
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
