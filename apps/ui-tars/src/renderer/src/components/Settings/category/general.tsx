import { useEffect, useState } from 'react';
import { Button } from '@renderer/components/ui/button';
import { RefreshCcw } from 'lucide-react';
import { api } from '@/renderer/src/api';
import { toast } from 'sonner';

export const GeneralSettings = () => {
  const [updateLoading, setUpdateLoading] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('-');
  const [updateDetail, setUpdateDetail] = useState<{
    version: string;
  } | null>(null);

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
      console.log('detail', detail);
      setCurrentVersion(detail.currentVersion);

      if (detail.updateInfo) {
        setUpdateDetail({
          version: detail.updateInfo.version,
        });
        return;
      } else if (!detail.isPackaged) {
        toast.info('未打包版本不支持检查更新');
      } else {
        toast.success('暂无可用更新', {
          description: `当前版本：${detail.currentVersion}，已是最新版本`,
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
      <div className="text-sm text-gray-500 mb-2">{`当前版本：v${currentVersion}`}</div>
      <Button
        variant="outline"
        type="button"
        disabled={updateLoading}
        onClick={handleCheckForUpdates}
      >
        <RefreshCcw
          className={`h-4 w-4 mr-2 ${updateLoading ? 'animate-spin' : ''}`}
        />
        {updateLoading ? '检查中...' : '检查更新'}
      </Button>
      {updateDetail?.version && (
        <div className="text-sm text-gray-500">
          {`发现新版本：v${updateDetail.version}`}
        </div>
      )}
    </>
  );
};
