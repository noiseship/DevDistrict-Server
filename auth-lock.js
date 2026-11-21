// Keep token refreshes exclusive across tabs sharing the same saved session.
export async function authLock(name, timeout, action) {
  const controller = new AbortController();
  const waitTime = timeout < 0 ? 5000 : timeout;
  let acquired = false;
  const timer = waitTime > 0 ? setTimeout(() => controller.abort(), waitTime) : null;
  let result;
  try {
    result = await navigator.locks.request(name,
      timeout === 0
        ? {mode: 'exclusive', ifAvailable: true}
        : {mode: 'exclusive', signal: controller.signal},
      async lock => {
        clearTimeout(timer);
        // Supabase uses timeout=0 for its optional background refresh tick.
        // Another tab owns the session, so leave this tick to that tab.
        if (!lock) return {skipped: true};
        acquired = true;
        // Return failures as data from the native callback. Propagate them
        // below, where Supabase's caller can handle the rejected promise.
        try {
          return {value: await action()};
        } catch (error) {
          return {failed: true, error};
        }
      });
  } catch (error) {
    if (controller.signal.aborted && !acquired) {
      throw Object.assign(new Error('Сессия занята другой вкладкой.'), {isAcquireTimeout: true});
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  if (result.skipped) {
    if (timeout === 0) return;
    throw Object.assign(new Error('Браузер не предоставил блокировку сессии.'), {isAcquireTimeout: true});
  }
  if (result.failed) throw result.error;
  return result.value;
}
