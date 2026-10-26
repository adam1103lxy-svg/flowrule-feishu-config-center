import PageHeader from '@client/src/components/shared/page-header';

const ConnectorsPage = () => (
  <div>
    <PageHeader
      title="连接器管理"
      description="维护独立的飞书连接器信息，App Secret 仅写入、永不回显明文。"
    />
    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      连接器列表加载中（接入后端接口后展示）。
    </div>
  </div>
);

export default ConnectorsPage;
