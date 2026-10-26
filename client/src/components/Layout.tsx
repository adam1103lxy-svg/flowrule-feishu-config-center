import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  Boxes,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Plug,
  ScrollText,
  Settings,
} from 'lucide-react';
import { cn } from '@client/src/lib/utils';
import { Button } from '@client/src/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@client/src/components/ui/sheet';

const NAV_ITEMS = [
  { to: '/', label: '工作台', icon: LayoutDashboard },
  { to: '/connectors', label: '连接器管理', icon: Plug },
  { to: '/rules', label: '规则列表', icon: FileText },
  { to: '/simulation', label: '模拟测试台', icon: FlaskConical },
  { to: '/integration', label: '接入中心', icon: Boxes },
  { to: '/audit', label: '审计与运行记录', icon: ScrollText },
  { to: '/settings', label: '设置', icon: Settings },
];

const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
  <nav className="flex flex-col gap-1" aria-label="主导航">
    {NAV_ITEMS.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors',
              isActive
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {item.label}
        </NavLink>
      );
    })}
  </nav>
);

const Brand = () => (
  <div className="flex items-center gap-2 px-1">
    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
      <Activity className="size-4" aria-hidden="true" />
    </div>
    <div className="leading-tight">
      <div className="text-sm font-semibold">FlowRule</div>
      <div className="text-xs text-muted-foreground">飞书规则配置中心</div>
    </div>
  </div>
);

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <aside className="hidden w-[232px] shrink-0 flex-col gap-6 border-r bg-background p-4 md:flex">
        <Brand />
        <NavList />
        <div className="mt-auto rounded-md border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
          本平台负责规则配置、发布、测试与审计。接入方运行时负责订阅飞书消息并执行任务。
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-background px-4 py-3 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="打开导航菜单">
                <Menu className="size-4" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4">
              <SheetHeader className="p-0 text-left">
                <SheetTitle asChild>
                  <div>
                    <Brand />
                  </div>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <NavList onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <span className="text-sm font-semibold">FlowRule</span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-muted/40">
          <div className="mx-auto max-w-[1200px] p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
