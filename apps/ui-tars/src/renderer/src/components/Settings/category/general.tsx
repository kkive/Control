import { useEffect, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/renderer/src/api';
import { Button } from '@renderer/components/ui/button';
import { Switch } from '@renderer/components/ui/switch';
import { Label } from '@renderer/components/ui/label';
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
import { useSetting } from '@renderer/hooks/useSetting';

const APP_DOWNLOAD_URL = 'https://tomato.wutanggroup.com/';

export const GeneralSettings = () => {
  const { settings, updateSetting } = useSetting();
  const [updateLoading, setUpdateLoading] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('-');
  const [updateDetail, setUpdateDetail] = useState<{
    version: string;
  } | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [userAgreementOpen, setUserAgreementOpen] = useState(false);
  const [privacyAgreementOpen, setPrivacyAgreementOpen] = useState(false);

  const analyticsEnabled = settings.analyticsEnabled ?? true;

  const handleAnalyticsChange = (checked: boolean) => {
    updateSetting({ ...settings, analyticsEnabled: checked });
  };

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
              {`检测到最新版本: v${updateDetail?.version ?? '-'}。 点击"下载"以安装最新软件包。`}
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

      <div className="flex gap-4 mt-4">
        <Button
          variant="link"
          className="p-0 h-auto text-sm text-muted-foreground"
          onClick={() => setUserAgreementOpen(true)}
        >
          用户协议
        </Button>
        <Button
          variant="link"
          className="p-0 h-auto text-sm text-muted-foreground"
          onClick={() => setPrivacyAgreementOpen(true)}
        >
          隐私协议
        </Button>
      </div>

      <AlertDialog open={userAgreementOpen} onOpenChange={setUserAgreementOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>用户协议</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div data-slot="alert-dialog-description" className="text-muted-foreground text-sm space-y-3">
                <p>
                  欢迎使用 Control。在使用本应用程序之前，请仔细阅读以下用户协议。
                </p>
                <p>
                  本应用程序提供的功能基于人工智能技术，通过自动化操作帮助用户完成设备上的任务。使用本应用程序即表示您同意以下条款：
                </p>
                <p>
                  1. 本应用程序按"现状"提供，不作任何明示或暗示的保证。
                </p>
                <p>
                  2. 用户应合理使用本应用程序，不得将其用于任何违法或有害的目的。
                </p>
                <p>
                  3. 用户在使用过程中产生的操作结果由用户自行承担。
                </p>
                <p>
                  4. 我们保留随时修改本协议的权利，修改后的协议将在应用程序中公布。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>确定</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={privacyAgreementOpen} onOpenChange={setPrivacyAgreementOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>隐私协议</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div data-slot="alert-dialog-description" className="text-muted-foreground text-sm space-y-3">
                <p>
                  我们重视您的隐私保护。本隐私协议说明了我们如何收集、使用和保护您的信息。
                </p>
                <p>
                  1. 本应用程序可能会收集匿名使用数据以改进服务质量，包括页面浏览、功能使用频率等统计信息。
                </p>
                <p>
                  2. 我们不会收集您的个人身份信息，除非您主动提供。
                </p>
                <p>
                  3. 收集的数据仅用于产品改进和服务优化，不会用于其他商业目的。
                </p>
                <p>
                  4. 您可以随时在设置中关闭数据收集功能。
                </p>
                <p>
                  5. 我们采取合理的安全措施保护您的数据安全。
                </p>
                <div className="flex items-center justify-between pt-3 border-t">
                  <Label htmlFor="analytics-switch" className="text-sm text-foreground">
                    允许分析数据
                  </Label>
                  <Switch
                    id="analytics-switch"
                    checked={analyticsEnabled}
                    onCheckedChange={handleAnalyticsChange}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>确定</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
