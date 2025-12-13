// 简单查询 Hook（替代 Vue Query）
import { ref, watch, computed } from 'vue';

export function useQuery({ queryKey, queryFn }: {
  queryKey?: any;
  queryFn: () => Promise<any>;
  staleTime?: number;
}) {
  const data = ref(null);
  const isLoading = ref(true);
  const isError = ref(false);
  const error = ref(null);

  async function refetch() {
    isLoading.value = true;
    isError.value = false;
    error.value = null;
    try {
      const result = await queryFn();
      data.value = result;
      console.log('Query result:', result);
    } catch (e: any) {
      isError.value = true;
      error.value = e;
      // 只在非 404 错误时打印（404 是正常的，表示资源不存在）
      if (!e.message || !e.message.includes('404')) {
        console.error('Query error:', e);
      }
    } finally {
      isLoading.value = false;
    }
  }

  // 如果 queryKey 是 computed，监听它的变化
  if (queryKey && typeof queryKey === 'object' && 'value' in queryKey) {
    // queryKey 是 computed ref
    watch(queryKey, () => {
      refetch();
    }, { immediate: true });
  } else if (queryKey !== undefined) {
    // queryKey 是普通值，监听它的变化
    watch(() => queryKey, () => {
      refetch();
    }, { immediate: true, deep: true });
  } else {
    // 没有 queryKey，立即执行一次
    refetch();
  }

  return { data, isLoading, isError, error, refetch };
}

