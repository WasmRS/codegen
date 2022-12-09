import {
  AnyType,
  ObjectMap,
} from "https://deno.land/x/apex_core@v0.1.0/model/mod.ts";
import { utils } from "https://deno.land/x/apex_codegen@v0.1.0/rust/mod.ts";

/**
 * Convert an Apex type to a type suitable for the destination format.
 *
 * @param typ - The Type node to convert.
 * @param config - The context's configuration.
 * @returns A string suitable for the destination format.
 *
 * @throws Throws if there is a type unaccounted for.
 */
export function convertType(
  typ: AnyType,
  config: ObjectMap,
  asRef = false,
  lifetime = "",
): string {
  return utils.types.apexToRustType(typ, config, asRef, lifetime);
}
