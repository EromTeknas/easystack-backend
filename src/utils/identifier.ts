import crypto from "node:crypto";

export function generateUniqueIdentifier(type: string, length: number = 12): string {
  let value = type;

  for (let index = 0; index < length - value.length; index++) {
    value += crypto.randomInt(0, 10).toString();
  }

  return value;
}