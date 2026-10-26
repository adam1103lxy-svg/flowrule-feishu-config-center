import PageHeader from '@client/src/components/shared/page-header';

const IntegrationPage = () => (
  <div>
    <PageHeader
      title="接入中心"
      description="配置拉取 API、发布 Webhook 与导出 JSON 三种接入方式。"
    />
    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      接入文档加载中（接入后端接口后展示）。
    </div>
  </div>
);

export default IntegrationPage;
