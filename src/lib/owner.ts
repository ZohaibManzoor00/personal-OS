/**
 * The single account that "owns" this app. The whole app is a read-only
 * showcase of the owner's content until the owner signs in; only the owner can
 * create/edit/delete or see locked (personal) sections and folders.
 *
 * Hardcoded for now — swap this out for a real multi-tenant model later.
 */
export const OWNER_EMAIL = "zo@gmail.com";

/** Case-insensitive check that an email belongs to the owner. */
export const isOwnerEmail = (email?: string | null): boolean => !!email && email.toLowerCase() === OWNER_EMAIL.toLowerCase();
