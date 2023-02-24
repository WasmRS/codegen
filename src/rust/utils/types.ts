import { AnyType, Kind, ObjectMap, Stream } from "../../deps/core/model.ts";
import { utils } from "../../deps/codegen/rust.ts";

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
  if (typ.kind === Kind.Stream) {
    const t = typ as Stream;
    return `FluxReceiver<${
      utils.types.apexToRustType(t.type, config, asRef, lifetime)
    },PayloadError>`;
  } else {
    return utils.types.apexToRustType(typ, config, asRef, lifetime);
  }
}
