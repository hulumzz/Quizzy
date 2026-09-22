const baseHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

export function jsonResponse(statusCode, payload, requestId) {
  return {
    statusCode,
    headers: {
      ...baseHeaders,
      ...(requestId ? { 'x-request-id': requestId } : {}),
    },
    body: JSON.stringify(payload),
  };
}

export function emptyResponse(statusCode = 204, requestId) {
  return {
    statusCode,
    headers: requestId ? { 'x-request-id': requestId } : {},
    body: '',
  };
}
