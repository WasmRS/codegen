/*
Copyright 2022 The NanoBus Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {
  Alias,
  AnyType,
  Context,
  Enum,
  Kind,
  List,
  Map,
  Named,
  Optional,
  Parameter,
  Primitive,
  PrimitiveName,
} from "../deps/core/model.ts";
import {
  expandType,
  fieldName,
  getImporter,
  getImports,
  Import,
  returnShare,
  translateAlias,
  translations,
} from "../deps/codegen/go.ts";
import {
  msgpackCastFuncs,
  msgpackCastNillableFuncs,
  msgpackDecodeFuncs,
  msgpackDecodeNillableFuncs,
  msgpackEncodeFuncs,
  msgpackEncodeNillableFuncs,
} from "./msgpack_constants.ts";
import { IMPORTS } from "./constants.ts";

/**
 * Creates string that is an msgpack read code block
 * @param variable variable that is being read
 * @param t the type node to write
 * @param prevOptional if type is being expanded and the parent type is optional
 * @param isReference if the type that is being expanded has a `@ref` annotation
 */
export function msgpackRead(
  context: Context,
  typeInstRef: boolean,
  variable: string,
  errorHandling: boolean,
  defaultVal: string,
  t: AnyType,
  prevOptional: boolean,
): string {
  const imports = getImports(context);
  const $ = getImporter(context, IMPORTS);
  const tr = translateAlias(context);
  let prefix = "return ";
  if (variable != "") {
    if (
      variable == "item" ||
      variable == "key" ||
      variable == "value" ||
      variable == "ret" ||
      variable == "request"
    ) {
      if (errorHandling) {
        prefix = variable + ", err := ";
      } else {
        prefix = variable + " := ";
      }
    } else {
      if (t.kind == Kind.Type && !prevOptional) {
        if (errorHandling) {
          prefix = "err = ";
        }
        return `${prefix}${variable}.Decode(decoder)\n`;
      }
      if (errorHandling) {
        prefix = variable + ", err = ";
      } else {
        prefix = variable + " = ";
      }
    }
  }

  if (t.kind == Kind.Alias) {
    const aliases = (context.config.aliases as { [key: string]: Import }) || {};
    const a = t as Alias;
    if (a.type.kind == Kind.Primitive) {
      const prim = a.type as Primitive;
      const imp = aliases[a.name];
      if (imp && imp.parse) {
        if (imp.import) {
          imports.thirdparty(imp.import);
        }
        if (prevOptional) {
          const decoder = msgpackDecodeNillableFuncs.get(prim.name)!;
          return `${prefix}${$.convert}.NillableParse(${imp.parse})(decoder.${decoder}())\n`;
        } else {
          const decoder = msgpackDecodeFuncs.get(prim.name)!;
          return `${prefix}${$.convert}.Parse(${imp.parse})(decoder.${decoder}())\n`;
        }
      }
      if (prevOptional) {
        const caster = msgpackCastNillableFuncs.get(prim.name)!;
        const decoder = msgpackDecodeNillableFuncs.get(prim.name)!;
        return `${prefix}${caster}[${a.name}](decoder.${decoder}())\n`;
      } else {
        const caster = msgpackCastFuncs.get(prim.name)!;
        const decoder = msgpackDecodeFuncs.get(prim.name)!;
        return `${prefix}${caster}[${a.name}](decoder.${decoder}())\n`;
      }
    }
    t = a.type;
  }

  switch (t.kind) {
    case Kind.Union:
    case Kind.Type:
    case Kind.Primitive: {
      const namedNode = t as Named;
      const amp = typeInstRef ? "&" : "";
      let decodeFn = `${$.msgpack}.Decode[${namedNode.name}](${amp}decoder)`;
      if (prevOptional) {
        decodeFn = `${$.msgpack}.DecodeNillable[${namedNode.name}](decoder)`;
      }
      if (prevOptional && msgpackDecodeNillableFuncs.has(namedNode.name)) {
        decodeFn = `decoder.${
          msgpackDecodeNillableFuncs.get(
            namedNode.name,
          )
        }()`;
      } else if (msgpackDecodeFuncs.has(namedNode.name)) {
        decodeFn = `decoder.${msgpackDecodeFuncs.get(namedNode.name)}()`;
      }
      return `${prefix}${decodeFn}\n`;
    }
    case Kind.Enum: {
      const e = t as Enum;
      let decodeFn = `${$.convert}.Numeric[${e.name}](decoder.ReadInt32())`;
      if (prevOptional) {
        decodeFn =
          `${$.convert}.NillableNumeric[${e.name}](decoder.ReadNillableInt32())`;
      }
      return `${prefix}${decodeFn}\n`;
    }
    case Kind.Map: {
      const m = t as Map;
      const expandedKey = expandType(
        m.keyType,
        undefined,
        true,
        tr,
      );
      const expandedVal = expandType(
        m.valueType,
        undefined,
        true,
        tr,
      );
      return `${prefix}${$.msgpack}.ReadMap(decoder, func(decoder ${$.msgpack}.Reader) (${expandedKey}, error) { ${
        msgpackRead(
          context,
          typeInstRef,
          "",
          false,
          defaultVal,
          m.keyType,
          false,
        )
      } }, func(decoder ${$.msgpack}.Reader) (${expandedVal}, error) { ${
        msgpackRead(
          context,
          typeInstRef,
          "",
          false,
          defaultVal,
          m.valueType,
          false,
        )
      } })\n`;
    }
    case Kind.List: {
      const l = t as List;
      const expanded = expandType(
        l.type,
        undefined,
        true,
        tr,
      );
      return `${prefix}${$.msgpack}.ReadSlice(decoder, func(decoder ${$.msgpack}.Reader) (${expanded}, error) { ${
        msgpackRead(
          context,
          typeInstRef,
          "",
          false,
          defaultVal,
          l.type,
          false,
        )
      } })\n`;
    }
    case Kind.Optional: {
      const optNode = t as Optional;
      return msgpackRead(
        context,
        typeInstRef,
        variable,
        errorHandling,
        defaultVal,
        optNode.type,
        true,
      );
    }
    default:
      return "unknown\n";
  }
}

/**
 * Creates string that is an msgpack write code block
 * @param typeInst name of variable which object that is writting is assigning to
 * @param typeClass class that is being written
 * @param typeMeth method that is being called
 * @param variable variable that is being written
 * @param t the type node to write
 * @param prevOptional if type is being expanded and the parent type is optional
 * @param isReference if the type that is being expanded has a `@ref` annotation
 */
export function msgpackWrite(
  context: Context,
  typeInst: string,
  typeInstRef: boolean,
  typeClass: string,
  typeMeth: string,
  variable: string,
  t: AnyType,
  prevOptional: boolean,
): string {
  let code = "";
  if (t.kind == Kind.Alias) {
    const aliases = (context.config.aliases as { [key: string]: Import }) || {};
    const a = t as Alias;
    const imp = aliases[a.name];
    const p = a.type as Primitive;
    if (imp && imp.format) {
      return `${typeInst}.${
        msgpackEncodeFuncs.get(p.name)
      }(${variable}.${imp.format}())\n`;
    }
    const castType = translations.get(p.name);
    if (prevOptional && msgpackEncodeNillableFuncs.has(p.name)) {
      return `${typeInst}.${
        msgpackEncodeNillableFuncs.get(
          p.name,
        )
      }((*${castType})(${variable}))\n`;
    }
    if (msgpackEncodeFuncs.has(p.name)) {
      return `${typeInst}.${
        msgpackEncodeFuncs.get(
          p.name,
        )
      }(${castType}(${variable}))\n`;
    }
    t = a.type;
  }
  switch (t.kind) {
    case Kind.Union:
    case Kind.Type:
    case Kind.Primitive: {
      const namedNode = t as Named;
      if (prevOptional && msgpackEncodeNillableFuncs.has(namedNode.name)) {
        return `${typeInst}.${
          msgpackEncodeNillableFuncs.get(
            namedNode.name,
          )
        }(${variable})\n`;
      }
      if (msgpackEncodeFuncs.has(namedNode.name)) {
        return `${typeInst}.${
          msgpackEncodeFuncs.get(
            namedNode.name,
          )
        }(${variable})\n`;
      }
      const amp = typeInstRef ? "&" : "";
      return `${variable}.${typeMeth}(${amp}${typeInst})\n`;
    }
    case Kind.Enum: {
      if (!prevOptional) {
        return `${typeInst}.WriteInt32(int32(${variable}))\n`;
      }
      return `${typeInst}.WriteNillableInt32((*int32)(${variable}))\n`;
    }
    case Kind.Map: {
      const mappedNode = t as Map;
      code += typeInst +
        `.WriteMapSize(uint32(len(${variable})))
      if ${variable} != nil { // TinyGo bug: ranging over nil maps panics.
      for k, v := range ${variable} {
        ${
          msgpackWrite(
            context,
            typeInst,
            typeInstRef,
            typeClass,
            typeMeth,
            "k",
            mappedNode.keyType,
            false,
          )
        }${
          msgpackWrite(
            context,
            typeInst,
            typeInstRef,
            typeClass,
            typeMeth,
            "v",
            mappedNode.valueType,
            false,
          )
        }}
      }\n`;
      return code;
    }
    case Kind.List: {
      const listNode = t as List;
      code += typeInst +
        `.WriteArraySize(uint32(len(${variable})))
      for _, v := range ${variable} {
        ${
          msgpackWrite(
            context,
            typeInst,
            typeInstRef,
            typeClass,
            typeMeth,
            "v",
            listNode.type,
            false,
          )
        }}\n`;
      return code;
    }
    case Kind.Optional: {
      const optionalNode = t as Optional;
      switch (optionalNode.type.kind) {
        case Kind.Alias: {
          const a = optionalNode.type as Alias;
          const aliases =
            (context.config.aliases as { [key: string]: Import }) || {};
          const imp = aliases[a.name];
          if (imp && imp.format) {
            break;
          }
        }
        /* falls through */
        case Kind.List:
        case Kind.Map:
        case Kind.Enum:
        case Kind.Type:
        case Kind.Primitive:
          return msgpackWrite(
            context,
            typeInst,
            typeInstRef,
            typeClass,
            typeMeth,
            variable,
            optionalNode.type,
            true,
          );
      }
      code += "if " + variable + " == nil {\n";
      code += typeInst + ".WriteNil()\n";
      code += "} else {\n";
      const vprefix = msgpackReturnDeref(context, optionalNode.type);
      code += msgpackWrite(
        context,
        typeInst,
        typeInstRef,
        typeClass,
        typeMeth,
        vprefix + variable,
        optionalNode.type,
        true,
      );
      code += "}\n";
      return code;
    }
    default:
      return "unknown\n";
  }
}

function msgpackReturnDeref(context: Context, type: AnyType): string {
  if (type.kind === Kind.Alias) {
    const a = type as Alias;
    const aliases = (context.config.aliases as { [key: string]: Import }) || {};
    const imp = aliases[a.name];
    if (imp && imp.format) {
      return "";
    }
    type = a.type;
  }
  if (type.kind === Kind.Primitive) {
    const p = type as Primitive;
    if (p.name != PrimitiveName.Bytes) {
      return "*";
    }
  }
  return "";
}

/**
 * Creates string that is an msgpack size code block
 * @param variable variable that is being size
 * @param t the type node to encode
 * @param isReference if the type that is being expanded has a `@ref` annotation
 */
export function msgpackSize(
  context: Context,
  typeInstRef: boolean,
  variable: string,
  t: AnyType,
): string {
  return msgpackWrite(
    context,
    "sizer",
    typeInstRef,
    "Writer",
    "Encode",
    variable,
    t,
    false,
  );
}

/**
 * Creates string that is an msgpack encode code block
 * @param variable variable that is being encode
 * @param t the type node to encode
 * @param isReference if the type that is being expanded has a `@ref` annotation
 */
export function msgpackEncode(
  context: Context,
  typeInstRef: boolean,
  variable: string,
  t: AnyType,
): string {
  return msgpackWrite(
    context,
    "encoder",
    typeInstRef,
    "Writer",
    "Encode",
    variable,
    t,
    false,
  );
}

export function msgpackVarAccessParam(
  variable: string,
  args: Parameter[],
): string {
  return (
    `ctx` +
    (args.length > 0 ? ", " : "") +
    args
      .map((arg) => {
        return `${returnShare(arg.type)}${variable}.${
          fieldName(
            arg,
            arg.name,
          )
        }`;
      })
      .join(", ")
  );
}
