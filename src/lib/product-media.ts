export function isProductVideo(url: string | null | undefined): boolean {
  return !!url && /\.(mp4|webm)(?:[?#]|$)/i.test(url);
}
