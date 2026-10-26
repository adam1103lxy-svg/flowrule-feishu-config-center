import PageHeader from '@client/src/components/shared/page-header';

const RuleEditorPage = () => (
  <div>
    <PageHeader title="规则编辑器" description="分区分步配置规则的全部能力。" />
    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      编辑器加载中（接入后端接口后展示）。
    </div>
  </div>
);

export default RuleEditorPage;
