import { Outlet } from 'react-router';
import { AppSidebar } from '@/renderer/src/components/SideBar/app-sidebar';
import { FeishuTaskBridge } from '@renderer/components/Feishu/FeishuTaskBridge';
import { WeixinTaskBridge } from '@renderer/components/Weixin/WeixinTaskBridge';
import { SidebarInset, SidebarProvider } from '@renderer/components/ui/sidebar';

export function MainLayout() {
  return (
    <SidebarProvider
      style={{ '--sidebar-width-icon': '72px' }}
      className="flex h-screen w-full bg-white"
    >
      <FeishuTaskBridge />
      <WeixinTaskBridge />
      <AppSidebar />
      <SidebarInset className="flex-1">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
