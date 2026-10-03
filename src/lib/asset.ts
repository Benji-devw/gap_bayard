/**
 * Préfixe un chemin du dossier public/ avec la base Vite (utile si le site vit dans un sous-dossier).
 * Adresse complète (https://…, ex. vidéo sur Cloudflare R2) : renvoyée telle quelle.
 */
export function asset(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}
