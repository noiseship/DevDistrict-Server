// Read the whole body inside the timeout: a connection may reset after HTTP 200.
export async function resilientFetch(input, options = {}, fetcher = fetch) {
  const method=(options.method || input?.method || 'GET').toUpperCase();
  const source=options.signal ?? input?.signal;
  for(let attempt=0;;attempt++) {
    const controller=new AbortController();
    const abort=()=>controller.abort(source.reason);
    if(source?.aborted) abort(); else source?.addEventListener('abort',abort,{once:true});
    const timeout=setTimeout(()=>controller.abort(new DOMException('Сервер не ответил за 15 секунд.','TimeoutError')),15000);
    try {
      if(source?.aborted) throw source.reason;
      const response=await fetcher(input,{...options,signal:controller.signal});
      const bytes=await response.arrayBuffer();
      if(method==='GET' && attempt===0 && [502,503,504].includes(response.status)) throw new Error('Temporary gateway failure');
      return new Response([204,205,304].includes(response.status)?null:bytes,{status:response.status,statusText:response.statusText,headers:response.headers});
    } catch(error) {
      if(source?.aborted) throw source.reason || error;
      if(method!=='GET' || attempt>=1) throw controller.signal.reason || error;
    } finally {clearTimeout(timeout);source?.removeEventListener('abort',abort);}
    await new Promise(resolve=>setTimeout(resolve,750));
  }
}
