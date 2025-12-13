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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c7c0288b-5f18-4399-aeaf-b757cde2bb7c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery.ts:35',message:'Setting up watch for computed queryKey',data:{queryKeyType:'computed',queryKeyValue:queryKey.value},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    watch(queryKey, (newVal, oldVal) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c7c0288b-5f18-4399-aeaf-b757cde2bb7c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery.ts:38',message:'queryKey changed, triggering refetch',data:{newVal,oldVal},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      refetch();
    }, { immediate: true });
  } else if (queryKey !== undefined) {
    // queryKey 是普通值，监听它的变化
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c7c0288b-5f18-4399-aeaf-b757cde2bb7c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery.ts:42',message:'Setting up watch for plain queryKey',data:{queryKeyType:'plain',queryKey},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    watch(() => queryKey, (newVal, oldVal) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c7c0288b-5f18-4399-aeaf-b757cde2bb7c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery.ts:44',message:'queryKey changed, triggering refetch',data:{newVal,oldVal},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      refetch();
    }, { immediate: true, deep: true });
  } else {
    // 没有 queryKey，立即执行一次
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c7c0288b-5f18-4399-aeaf-b757cde2bb7c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery.ts:47',message:'No queryKey, executing immediately',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    refetch();
  }

  return { data, isLoading, isError, error, refetch };
}

