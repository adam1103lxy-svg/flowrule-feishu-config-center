import PageHeader from '@client/src/components/shared/page-header';

const AuditPage = () => (
  <div>
    <PageHeader
      title="审计与运行记录"
      description="规则创建、修改、发布、模拟测试与导出全量留痕。Demo 数据明确标识。"
    />
    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      审计记录加载中（接入后端接口后展示）。
    </div>
  </div>
);

export default AuditPage;
