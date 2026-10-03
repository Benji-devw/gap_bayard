/**
 * Requêtes « mobile » partagées avec villa.css : garder les mêmes valeurs des deux côtés.
 * Un téléphone à l'horizontale fait 740 à 950 px de large : on le reconnaît à son écran
 * tactile et à sa faible hauteur, pour lui donner la mise en page mobile.
 */
export const PHONE_LANDSCAPE = '(pointer: coarse) and (max-height: 500px)';

/** Menu burger à la place de la navigation (≤ 900 px, ou téléphone couché) */
export const MENU_QUERY = `(max-width: 900px), ${PHONE_LANDSCAPE}`;

/** Écran tactile (téléphone, tablette) : réglages propres au mobile, ex. volume de la musique */
export const TOUCH_QUERY = '(pointer: coarse)';

/** Fiche produit en panneau fixe plutôt qu'en bulle à côté du point */
export const SHEET_QUERY = `(max-width: 760px), ${PHONE_LANDSCAPE}`;
