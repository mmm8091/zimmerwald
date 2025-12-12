// 简单查询 Hook（替代 Vue Query）
import { ref } from 'vue';

export function useQuery({ queryKey, queryFn, staleTime = 30000 }: {
  queryKey: any;
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

  // 立即执行，不等待 mounted
  refetch();

  return { data, isLoading, isError, error, refetch };
}

