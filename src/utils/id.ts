import { customAlphabet } from "nanoid";

export const idDetails = {
  workspace: {
    length: 16,
  },
  issue: {
    length: 10,
  },
  comment: {
    length: 10,
  },
  description: {
    length: 10,
  },
} as const;

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const nanoid = customAlphabet(chars);

export function generateId(model: keyof typeof idDetails) {
  const length = idDetails[model].length;
  return nanoid(length);
}
