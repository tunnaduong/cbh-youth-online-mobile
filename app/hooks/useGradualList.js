import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Shows a long, already-downloaded list a page at a time and reveals the next
// page when the user scrolls near the end (FlatList `onEndReached`) - the same
// idea as the Games screen. The saved / liked / activity endpoints return
// everything at once, so this keeps the first render and the number of mounted
// rows small without needing a paginated API.
//
// - A new array (pull to refresh, a new fetch) starts again from the first page.
// - The lock is a ref, so a burst of onEndReached calls reveals one page only.
// - `hasMore` / `loadingMore` drive the footer spinner.
export default function useGradualList(items, pageSize = 15) {
  const total = items?.length ?? 0;
  const [count, setCount] = useState(pageSize);
  const [loadingMore, setLoadingMore] = useState(false);
  const lockRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setCount(pageSize);
    setLoadingMore(false);
    lockRef.current = false;
  }, [items, pageSize]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const visible = useMemo(() => (items ? items.slice(0, count) : []), [items, count]);
  const hasMore = count < total;

  const onEndReached = useCallback(() => {
    if (lockRef.current || count >= total) return;
    lockRef.current = true;
    setLoadingMore(true);
    // Short pause so the spinner shows and the scroll settles before the next
    // page mounts.
    timerRef.current = setTimeout(() => {
      setCount((prev) => Math.min(prev + pageSize, total));
      setLoadingMore(false);
      lockRef.current = false;
    }, 60);
  }, [count, total, pageSize]);

  return { visible, hasMore, loadingMore, onEndReached };
}
