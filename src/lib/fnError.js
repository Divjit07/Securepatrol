/**
 * Extract the real error message from a supabase.functions.invoke failure.
 * FunctionsHttpError hides the response body ("email already registered",
 * "only admins can…") behind a generic "Edge Function returned a non-2xx
 * status code" — read error.context (the Response) to get the actual reason.
 */
export async function readFnError(fnError, fallback = 'Request failed') {
  if (!fnError) return fallback
  try {
    const body = await fnError.context?.json()
    if (body?.error) return body.error
  } catch {
    /* body not JSON */
  }
  if (fnError.message?.includes('FunctionsFetchError') || fnError.name === 'FunctionsFetchError') {
    return 'Service not deployed or unreachable — check the edge function.'
  }
  return fnError.message || fallback
}
