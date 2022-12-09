import {
  ObjectMap,
  Parameter,
} from "https://deno.land/x/apex_core@v0.1.0/model/mod.ts";
import { utils } from "https://deno.land/x/apex_codegen@v0.1.0/rust/mod.ts";
import { convertType } from "./types.ts";

/**
 * Convert a description to the appropriate format for the destination.
 *
 * @param description - A string description.
 * @returns A string suitable for the destination format or an empty string.
 */
export function convertDescription(description?: string): string {
  return utils.rustDoc(description);
}

/**
 * Generate new source for a Parameter
 *
 * @param param - A Parameter node to convert
 * @param config - The context's configuration.
 * @returns The new generated output for the Parameter
 */
export function convertParameter(param: Parameter, config: ObjectMap): string {
  // The name of the Parameter
  const _name = param.name;

  // The type of the Parameter, converted via `convertType()`
  const _type = convertType(param.type, config);

  // Combine the above to create and return new output here.
  return ``;
}
