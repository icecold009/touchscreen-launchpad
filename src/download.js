export function downloadText({ documentRef, windowRef, urlApi = URL, BlobCtor = Blob }, filename, content, mimeType) {
  const blob = new BlobCtor([content], { type: mimeType });
  downloadBlob({ documentRef, windowRef, urlApi }, filename, blob);
}

export function downloadBlob({ documentRef, windowRef, urlApi = URL }, filename, blob) {
  const url = urlApi.createObjectURL(blob);
  const link = documentRef.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  documentRef.body.append(link);
  try {
    link.click();
  } finally {
    windowRef.setTimeout(() => {
      link.remove();
      urlApi.revokeObjectURL(url);
    }, 1000);
  }
}
