import { supabase } from "./supabase"
import { decode } from "base64-arraybuffer"
import * as FileSystem from "expo-file-system/legacy"

/**
 * Sube una imagen de evento al bucket `event-images`.
 * Crea el bucket si no existe (requiere hacerlo manualmente en panel si RLS lo bloquea).
 * @param uri local URI de la imagen seleccionada
 * @param venueId para agrupar por local
 * @returns public URL
 */
export async function uploadEventImage(uri: string, venueId: string): Promise<string> {
  if (!uri) throw new Error("URI de imagen vacío")
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) throw new Error("No autenticado")

  // Leer binario
  // Expo SDK 54: usar expo-file-system/legacy para readAsStringAsync
  const fileBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
  const fileName = `${venueId || 'unknown'}/${Date.now()}.jpg`
  const bucket = "event-images"

  // Subir
  const { error } = await supabase.storage.from(bucket).upload(fileName, decode(fileBase64), {
    contentType: "image/jpeg",
    upsert: false,
  })
  if (error) throw error

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(fileName)
  if (!publicUrlData?.publicUrl) throw new Error("No se pudo obtener la URL pública")
  return publicUrlData.publicUrl
}

/**
 * Sube una imagen de comprobante de asistencia externa.
 * Bucket: attendance-proofs (puede ser privado o público según tus políticas)
 * Devuelve la URL pública si el bucket es público; en caso contrario puedes almacenar la ruta `path` y generar signed URLs al mostrar.
 */
export async function uploadAttendanceProof(
  uri: string,
  venueId: string,
  eventId: string
): Promise<{ url: string; path: string }> {
  if (!uri) throw new Error("URI de imagen vacío")
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) throw new Error("No autenticado")

  // Expo SDK 54: usar API legacy para leer base64
  const fileBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
  const bucket = "attendance-proofs"
  const fileName = `${venueId || 'unknown'}/${eventId || 'event'}/${Date.now()}.jpg`

  const { error } = await supabase.storage.from(bucket).upload(fileName, decode(fileBase64), {
    contentType: "image/jpeg",
    upsert: false,
  })
  if (error) throw error

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(fileName)
  const url = publicUrlData?.publicUrl || ""
  return { url, path: fileName }
}
