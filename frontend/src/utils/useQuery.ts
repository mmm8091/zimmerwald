// 简单查询 Hook（替代 Vue Query）
import { ref, watch } from 'vue';

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
    console.log('[useQuery] 设置 computed queryKey watch, 初始值:', JSON.stringify(queryKey.value));
    watch(queryKey, (newVal, oldVal) => {
      console.log('[useQuery] queryKey 改变，触发 refetch', {
        oldVal: JSON.stringify(oldVal),
        newVal: JSON.stringify(newVal),
        oldValStr: oldVal ? JSON.stringify(oldVal) : 'null',
        newValStr: newVal ? JSON.stringify(newVal) : 'null',
      });
      refetch();
    }, { immediate: true, deep: true });
  } else if (queryKey !== undefined) {
    // queryKey 是普通值，监听它的变化
    console.log('[useQuery] 设置普通 queryKey watch, 初始值:', JSON.stringify(queryKey));
    watch(() => queryKey, (newVal, oldVal) => {
      console.log('[useQuery] queryKey 改变，触发 refetch', {
        oldVal: JSON.stringify(oldVal),
        newVal: JSON.stringify(newVal),
      });
      refetch();
    }, { immediate: true, deep: true });
  } else {
    // 没有 queryKey，立即执行一次
    console.log('[useQuery] 没有 queryKey，立即执行');
    refetch();
  }

  return { data, isLoading, isError, error, refetch };
}

