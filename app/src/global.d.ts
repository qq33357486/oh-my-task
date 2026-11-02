/**
 * lib.dom 未收录的 File System Access API 入口（Chrome/Edge）。
 * 句柄类型 FileSystemHandle 等已在 lib.dom 中。
 */
interface Window {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
}
