import PageHeader from '@client/src/components/shared/page-header';

const RulesPage = () => (
  <div>
    <PageHeader
      title="规则列表"
      description="搜索、筛选、复制、启停与查看版本历史。"
    />
    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      规则列表加载中（接入后端接口后展示）。
    </div>
  </div>
);

export default RulesPage;
