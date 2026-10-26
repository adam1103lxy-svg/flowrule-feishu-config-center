import PageHeader from '@client/src/components/shared/page-header';

const SettingsPage = () => (
  <div>
    <PageHeader title="设置" description="工作区名称、默认时区、扫描周期、待确认策略与安全说明。" />
    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      设置加载中（接入后端接口后展示）。
    </div>
  </div>
);

export default SettingsPage;
