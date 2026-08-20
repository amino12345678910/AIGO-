export function log(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

export function error(message: string, err?: unknown) {
  const timestamp = new Date().toISOString();
  if (err instanceof Error) {
    console.error(`[${timestamp}] ERROR: ${message}`, err.message);
  } else {
    console.error(`[${timestamp}] ERROR: ${message}`, err);
  }
}
