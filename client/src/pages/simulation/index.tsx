import PageHeader from '@client/src/components/shared/page-header';

const SimulationPage = () => (
  <div>
    <PageHeader
      title="模拟测试台"
      description="选择草稿规则，用匿名示例消息验证命中结果。模拟不调用飞书、不创建任务。"
    />
    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      模拟测试台加载中（接入后端接口后展示）。
    </div>
  </div>
);

export default SimulationPage;
