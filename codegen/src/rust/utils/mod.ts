import { noCase } from "../../deps/codegen/utils.ts";
import { Kind, Operation } from "../../deps/core/model.ts";
export * as types from "./types.ts";
export * as convert from "./conversions.ts";

/**
 * A utility function to checks if a name is a reserved word.
 *
 * @param name - The name to check.
 * @returns true or false depending on if the name is found in the reservedWords list.
 */
export function isReservedWord(name: string): boolean {
  return reservedWords.includes(name);
}

/**
 * A list of reserved words that should not be used as identifier names
 *
 * @remarks
 * Modify this list with reserved words for your destination format, or empty
 * it for looser formats.
 */
const reservedWords = [
  "new", // examples
  "function",
  "class",
];

export function constantCase(str: string): string {
  return noCase(str, {
    delimiter: "_",
    transform: (str) => str.toUpperCase(),
  });
}

export function determineVariant(operation: Operation): ActionKind {
  const numInputs = operation.parameters.length;
  const numInputStream =
    operation.parameters.filter((p) => p.type.kind === Kind.Stream).length;
  const isOutputStream = operation.type.kind === Kind.Stream;

  if (numInputStream == 1 && numInputs === 1 && isOutputStream) {
    return ActionKind.RequestChannel;
  } else if (numInputStream === 0 && isOutputStream) {
    return ActionKind.RequestStream;
  } else if (numInputStream === 0 && !isOutputStream) {
    return ActionKind.RequestResponse;
  } else {
    throw new Error(
      "Unsupported action type. Actions inputs must be RequestResponse (`(no streams): non-stream`), RequestStream (`(no streams): stream`), or RequestChannel (`(one stream): stream`).",
    );
  }
}

export enum ActionKind {
  RequestResponse,
  RequestStream,
  RequestChannel,
}

export type NamespaceAction = [string, string];

export class Actions {
  [ActionKind.RequestResponse]: NamespaceAction[] = [];
  [ActionKind.RequestStream]: NamespaceAction[] = [];
  [ActionKind.RequestChannel]: NamespaceAction[] = [];

  merge(actions: Actions) {
    this[ActionKind.RequestResponse].push(
      ...actions[ActionKind.RequestResponse],
    );
    this[ActionKind.RequestStream].push(
      ...actions[ActionKind.RequestStream],
    );
    this[ActionKind.RequestChannel].push(
      ...actions[ActionKind.RequestChannel],
    );
  }

  num(): number {
    return this[ActionKind.RequestResponse].length +
      this[ActionKind.RequestStream].length +
      this[ActionKind.RequestChannel].length;
  }
}
