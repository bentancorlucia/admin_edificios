import { save } from "@tauri-apps/plugin-dialog"
import { writeFile, BaseDirectory } from "@tauri-apps/plugin-fs"
import { documentDir, join } from "@tauri-apps/api/path"

export async function savePDFWithDialog(result: { arrayBuffer: ArrayBuffer; fileName: string } | undefined) {
  if (!result) return false
  const { arrayBuffer, fileName } = result
  const docsPath = await documentDir()
  const defaultPath = await join(docsPath, fileName)
  const filePath = await save({
    defaultPath,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  })
  if (filePath) {
    await writeFile(filePath, new Uint8Array(arrayBuffer))
    return true
  }
  return false
}
