export function attachStorageRequest(request, transaction, resolve, reject) {
  const rejectStorageOperation = () => reject(request.error || new Error("Sample storage failed."));

  request.addEventListener("success", () => resolve(request.result), { once: true });
  request.addEventListener("error", rejectStorageOperation, { once: true });
  transaction.addEventListener("abort", rejectStorageOperation, { once: true });
}
