/** File content the SDK can upload: a Blob/File, or raw bytes. */
export type UploadData = Blob | ArrayBuffer | Uint8Array;

/** Multipart body with one "file" field. */
export function fileForm(data: UploadData, filename: string, contentType?: string): FormData {
  const blob = data instanceof Blob
    ? data
    : new Blob([data instanceof Uint8Array ? data : new Uint8Array(data)], contentType ? { type: contentType } : undefined);
  const form = new FormData();
  form.append('file', blob, filename);
  return form;
}
