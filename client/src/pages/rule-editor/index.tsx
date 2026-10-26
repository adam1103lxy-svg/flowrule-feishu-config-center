import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@client/src/components/shared/page-header';
import { getApiErrorMessage } from '@client/src/utils/api-error';
import { Alert, AlertDescription, AlertTitle } from '@client/src/components/ui/alert';
import { Button } from '@client/src/components/ui/button';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { useRuleDetail } from '@client/src/api/rules';
import RuleForm from './rule-form';

const RuleEditorPage = () => {
  const { ruleId } = useParams<{ ruleId: string }>();
  const isNew = !ruleId;
  const { data: rule, isLoading, isError, error, refetch } = useRuleDetail(ruleId);

  const title = isNew ? '新建规则' : `编辑规则${rule ? `：${rule.name}` : ''}`;

  return (
    <div>
      <PageHeader
        title={title}
        description={
          isNew
            ? '分区分步配置新规则；保存草稿后可提交校验与发布。'
            : '分区编辑规则的全部可配置项，支持校验、发布与回滚。'
        }
        actions={
          <Button asChild variant="outline" className="whitespace-nowrap">
            <Link to="/rules">
              <ArrowLeft className="size-4" />
              返回列表
            </Link>
          </Button>
        }
      />

      {isNew ? (
        <RuleForm key="new" ruleId={undefined} rule={null} />
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError || !rule ? (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTitle>规则加载失败</AlertTitle>
            <AlertDescription className="mt-2">
              {getApiErrorMessage(error)}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-2 whitespace-nowrap"
                onClick={() => void refetch()}
              >
                重试
              </Button>
            </AlertDescription>
          </Alert>
          <Button asChild variant="outline" className="whitespace-nowrap">
            <Link to="/rules">返回列表</Link>
          </Button>
        </div>
      ) : (
        <RuleForm key={rule.id} ruleId={rule.id} rule={rule} />
      )}
    </div>
  );
};

export default RuleEditorPage;
