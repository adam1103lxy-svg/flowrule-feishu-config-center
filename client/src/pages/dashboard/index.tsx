import PageHeader from '@client/src/components/shared/page-header';

const DashboardPage = () => (
  <div>
    <PageHeader
      title="工作台"
      description="规则配置总览：规则状态分布、近 7 天模拟测试与最近发布版本。"
    />
    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      统计数据加载中（接入后端接口后展示）。
    </div>
  </div>
);

export default DashboardPage;
