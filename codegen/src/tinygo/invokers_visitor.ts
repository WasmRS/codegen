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
  Context,
  Enum,
  Interface,
  Kind,
  List,
  Map,
  Named,
  Primitive,
  Stream,
  Writer,
} from "../deps/core/model.ts";
import {
  expandType,
  fieldName,
  getImporter,
  getImports,
  GoVisitor,
  Import,
  mapParam,
  methodName,
  parameterName,
  translateAlias,
} from "../deps/codegen/go.ts";
import {
  capitalize,
  isObject,
  isPrimitive,
  isVoid,
  operationArgsType,
} from "../deps/codegen/utils.ts";
import { msgpackRead, msgpackWrite } from "./msgpack_helpers.ts";
import { getOperationParts } from "./utilities.ts";
import {
  IMPORTS,
  primitiveDecode,
  primitiveToBytes,
  primitiveTransformers,
} from "./constants.ts";

export class InvokersVisitor extends GoVisitor {
  private resources: Set<string>;

  constructor(writer: Writer, resources: Set<string>) {
    super(writer);
    this.resources = resources;
  }

  visitOperation(context: Context): void {
    this.doHandler(context);
  }

  visitFunction(context: Context): void {
    this.doHandler(context);
  }

  visitParam(context: Context): void {
    const { parameter } = context;
    const translate = translateAlias(context);
    this.write(`, ${mapParam(context, parameter, undefined, translate)}`);
  }

  visitOperationReturn(context: Context): void {
    const { operation } = context;
    const $ = getImporter(context, IMPORTS);
    const translate = translateAlias(context);
    let rxWrapper;
    if (!isVoid(operation.type)) {
      let t = operation.type;
      if (t.kind == Kind.Stream) {
        const s = t as Stream;
        t = s.type;
        rxWrapper = `${$.flux}.Flux`;
      } else {
        rxWrapper = `${$.mono}.Mono`;
      }
      const expanded = expandType(t, undefined, true, translate);
      this.write(` ${rxWrapper}[${expanded}]`);
    } else {
      this.write(` ${$.mono}.Void`);
    }
  }

  doHandler(context: Context): void {
    const tr = translateAlias(context);
    const { interface: iface, operation } = context;
    const $ = getImporter(context, IMPORTS);
    const imports = getImports(context);

    const { type, unaryIn, parameters, streamIn, returns, returnPackage } =
      getOperationParts(operation);

    const returnType = !returns || isVoid(returns)
      ? "struct{}"
      : returns.kind == Kind.Interface
      ? (returns as Interface).name
      : expandType(returns, undefined, false, tr);

    let receiver = "";
    if (iface) {
      const structName = iface.name + "Client";
      receiver = structName.substring(0, 1).toLowerCase();
      this.write(
        `func (${receiver} *${structName}) ${
          methodName(
            operation,
            operation.name,
          )
        }(ctx ${$.context}.Context`,
      );
    } else {
      this.write(
        `func (c *Client) ${
          methodName(operation, operation.name)
        }(ctx ${$.context}.Context`,
      );
    }

    operation.parameters.forEach((p) =>
      this.visitParam(context.clone({ parameter: p }))
    );
    this.write(`)`);
    this.visitOperationReturn(context);
    this.write(` {\n`);

    if (unaryIn) {
      if (unaryIn.type.kind == Kind.Enum) {
        this
          .write(
            `payloadData, err := ${$.msgpack}.I32ToBytes(int32(${
              parameterName(
                unaryIn,
                unaryIn.name,
              )
            }))
        if err != nil {
          return ${returnPackage}.Error[${returnType}](err)
        }\n`,
          );
      } else if (unaryIn.type.kind == Kind.Alias) {
        const a = unaryIn.type as Alias;
        const aliases = (context.config.aliases as { [key: string]: Import }) ||
          {};
        const imp = aliases[a.name];
        if (imp && imp.format) {
          if (imp.import) {
            imports.thirdparty(imp.import);
          }
          this.write(
            `payloadData, err := ${$.msgpack}.${
              primitiveToBytes.get("string")
            }(${
              parameterName(
                unaryIn,
                unaryIn.name,
              )
            }.${imp.format}())
          if err != nil {
            return ${returnPackage}.Error[${returnType}](err)
          }\n`,
          );
        } else {
          const primitiveExpanded = expandType(a.type, undefined, false, tr);
          this.write(
            `payloadData, err := ${$.msgpack}.${
              primitiveToBytes.get(primitiveExpanded)
            }(${primitiveExpanded}(${
              parameterName(
                unaryIn,
                unaryIn.name,
              )
            }))
          if err != nil {
            return ${returnPackage}.Error[${returnType}](err)
          }\n`,
          );
        }
      } else if (unaryIn.type.kind == Kind.List) {
        const l = unaryIn.type as List;
        const expanded = expandType(l.type, undefined, false, tr);
        this.write(
          `payloadData, err := ${$.msgpack}.SliceToBytes(${
            parameterName(
              unaryIn,
              unaryIn.name,
            )
          }, func(writer ${$.msgpack}.Writer, val ${expanded}) {
            ${
            msgpackWrite(
              context,
              "writer",
              false,
              "",
              "",
              "val",
              l.type,
              false,
            )
          } })
        if err != nil {
          return ${returnPackage}.Error[${returnType}](err)
        }\n`,
        );
      } else if (unaryIn.type.kind == Kind.Map) {
        const m = unaryIn.type as Map;
        const expandedKey = expandType(m.keyType, undefined, false, tr);
        const expandedVal = expandType(m.valueType, undefined, false, tr);
        this.write(
          `payloadData, err := ${$.msgpack}.MapToBytes(${
            parameterName(
              unaryIn,
              unaryIn.name,
            )
          }, func(writer ${$.msgpack}.Writer, val ${expandedKey}) {
            ${
            msgpackWrite(
              context,
              "writer",
              false,
              "",
              "",
              "val",
              m.keyType,
              false,
            )
          } }, func(writer ${$.msgpack}.Writer, val ${expandedVal}) {
            ${
            msgpackWrite(
              context,
              "writer",
              false,
              "",
              "",
              "val",
              m.valueType,
              false,
            )
          } })
        if err != nil {
          return ${returnPackage}.Error[${returnType}](err)
        }\n`,
        );
      } else if (isObject(unaryIn.type)) {
        this.write(`payloadData, err := ${$.msgpack}.ToBytes(${
          parameterName(
            unaryIn,
            unaryIn.name,
          )
        })
        if err != nil {
          return ${returnPackage}.Error[${returnType}](err)
        }\n`);
      } else if (isPrimitive(unaryIn.type)) {
        const p = unaryIn.type as Primitive;
        this.write(`payloadData, err := ${$.msgpack}.${
          primitiveToBytes.get(
            p.name,
          )
        }(${parameterName(unaryIn, unaryIn.name)})
        if err != nil {
          return ${returnPackage}.Error[${returnType}](err)
        }\n`);
      }
    } else {
      if (parameters.length > 0) {
        const argsName = operationArgsType(iface, operation);
        this.write(`request := ${argsName} {\n`);
        parameters.forEach((p) => {
          const ref = isObject(p.type, false) ? "*" : "";
          this.write(
            `\t${fieldName(p, p.name)}: ${ref}${parameterName(p, p.name)},\n`,
          );
        });
        this.write(`}
        payloadData, err := ${$.msgpack}.ToBytes(&request)
        if err != nil {
          return ${returnPackage}.Error[${returnType}](err)
        }\n`);
      } else {
        this.write(`payloadData := []byte{}\n`);
      }
    }
    const opVar = iface
      ? `${receiver}.c._op${iface.name}${methodName(operation, operation.name)}`
      : `c._op${methodName(operation, operation.name)}`;
    const callerVar = iface ? `${receiver}.c.caller` : `c.caller`;
    this.write(
      `var metadata [16]byte
      stream, ok := ${$.proxy}.FromContext(ctx)
      ${$.binary}.BigEndian.PutUint32(metadata[0:4], ${opVar})
      if ok {
        ${$.binary}.BigEndian.PutUint32(metadata[4:8], stream.StreamID())
      }\n`,
    );
    if (iface && this.resources.has(iface.name)) {
      this.write(
        `binary.BigEndian.PutUint64(metadata[8:], ${receiver}.instanceID)\n`,
      );
    }
    this.write(`pl := ${$.payload}.New(payloadData, metadata[:])\n`);
    if (streamIn) {
      let transformFn = "";
      switch (streamIn.type.kind) {
        case Kind.Primitive: {
          const p = streamIn.type as Primitive;
          imports.thirdparty(IMPORTS.transform);
          transformFn = `${
            primitiveTransformers.get(
              p.name,
            )
          }.Encode`;
          break;
        }
        case Kind.Alias: {
          const a = streamIn.type as Alias;
          if (a.type.kind == Kind.Primitive) {
            const p = a.type as Primitive;
            const aliases =
              (context.config.aliases as { [key: string]: Import }) ||
              {};
            const imp = aliases[a.name];
            if (imp && imp.parse) {
              if (imp.import) {
                imports.thirdparty(imp.import);
              }
              transformFn =
                `${$.transform}.ToStringEncode(func (val ${imp.type}) string {
                return val.${imp.format}()
              })`;
            } else {
              transformFn = `${$.transform}.${
                capitalize(p.name)
              }Encode[${a.name}]`;
            }
          } else {
            const expanded = expandType(a.type, undefined, undefined, tr);
            transformFn = `func(value ${a.name}) (payload.Payload, error) {
                return ${$.transform}.CodecEncode((*${expanded})(&value))
              }`;
          }
          break;
        }
        case Kind.Enum: {
          const e = streamIn.type as Enum;
          transformFn = `${$.transform}.Int32Encode[${e.name}]`;
          break;
        }
        case Kind.List: {
          const l = streamIn.type as List;
          const expanded = expandType(l.type, undefined, undefined, tr);
          transformFn =
            `${$.transform}.SliceEncode(func(writer ${$.msgpack}.Writer, val ${expanded}) {
          ${
              msgpackWrite(
                context,
                "writer",
                false,
                "",
                "",
                "val",
                l.type,
                false,
              )
            } })`;
          break;
        }
        case Kind.Map: {
          const m = streamIn.type as Map;
          const expandedKey = expandType(m.keyType, undefined, undefined, tr);
          const expandedVal = expandType(m.valueType, undefined, undefined, tr);
          transformFn =
            `${$.transform}.MapEncode(func(writer ${$.msgpack}.Writer, key ${expandedKey}) {
          ${
              msgpackWrite(
                context,
                "writer",
                false,
                "",
                "",
                "key",
                m.keyType,
                false,
              )
            } }, func(writer ${$.msgpack}.Writer, val ${expandedVal}) {
          ${
              msgpackWrite(
                context,
                "writer",
                false,
                "",
                "",
                "val",
                m.valueType,
                false,
              )
            } })`;
          break;
        }
        case Kind.Type:
        case Kind.Union: {
          const t = streamIn.type as Named;
          transformFn = `${$.transform}.MsgPackEncode[${t.name}]`;
          break;
        }
        default: {
          console.error(streamIn.type.kind);
        }
      }
      const inMap = `${$.flux}.Map(${streamIn.parameter.name}, ${transformFn})`;
      if (returns && operation.type.kind != Kind.Stream && !isVoid(returns)) {
        this.write(`futureStream := ${callerVar}.${type}(ctx, pl, ${inMap})\n`);
        this.write(`future := ${$.transform}.FluxToMono(futureStream)\n`);
      } else {
        this.write(`future := ${callerVar}.${type}(ctx, pl, ${inMap})\n`);
      }
    } else {
      this.write(`future := ${callerVar}.${type}(ctx, pl)\n`);
    }
    if (streamIn && (!returns || isVoid(returns))) {
      this.write(`return ${$.transform}.FluxToVoid(future)\n`);
    } else if (returns.kind == Kind.Alias) {
      const a = returns as Alias;
      if (a.type.kind == Kind.Primitive) {
        const p = a.type as Primitive;
        const aliases = (context.config.aliases as { [key: string]: Import }) ||
          {};
        const imp = aliases[a.name];
        if (imp && imp.parse) {
          if (imp.import) {
            imports.thirdparty(imp.import);
          }
          this.write(
            `return ${returnPackage}.Map(future, ${$.transform}.ToStringDecode(func (val string) (${imp.type}, error) {
                  return ${imp.parse}(val)
                }))`,
          );
        } else {
          imports.thirdparty(IMPORTS.transform);
          this.write(
            `return ${returnPackage}.Map(future, ${$.transform}.${
              primitiveDecode.get(
                p.name,
              )
            }[${a.name}])\n`,
          );
        }
      } else {
        const expanded = expandType(a.type, undefined, undefined, tr);
        this.write(
          `return ${returnPackage}.Map(future, func(raw ${$.payload}.Payload) (val ${a.name}, err error) {
            err = ${$.transform}.CodecDecode(raw, (*${expanded})(&val))
            return val, err
          })\n`,
        );
      }
    } else if (returns.kind == Kind.Interface) {
      const c = iface ? `${receiver}.c` : `c`;
      this.write(
        `return ${$.mono}.Map(future, func(p ${$.payload}.Payload) (${returnType}, error) {
        instId, err := ${$.transform}.Uint64.Decode(p)
        if err != nil {
          return nil, err
        }
        return &${returnType}Client{
          c:          ${c},
          instanceID: instId,
        }, nil
      })\n`,
      );
    } else if (returns.kind == Kind.Enum) {
      const e = returns as Enum;
      this.write(
        `return ${returnPackage}.Map(future, ${$.transform}.Int32Decode[${e.name}])\n`,
      );
    } else if (isPrimitive(returns)) {
      const p = returns as Primitive;
      const transform = primitiveTransformers.get(p.name);
      this.write(`return ${returnPackage}.Map(future, ${transform}.Decode)\n`);
    } else if (returns.kind == Kind.List) {
      const l = returns as List;
      const expanded = expandType(l.type, undefined, false, tr);
      this.write(
        `return ${returnPackage}.Map(future, ${$.transform}.SliceDecode(func(decoder ${$.msgpack}.Reader) (${expanded}, error) {
          ${
          msgpackRead(
            context,
            false,
            "",
            false,
            "",
            l.type,
            false,
          )
        }}))\n`,
      );
    } else if (returns.kind == Kind.Map) {
      const m = returns as Map;
      const expandedKey = expandType(m.keyType, undefined, false, tr);
      const expandedVal = expandType(m.valueType, undefined, false, tr);
      this.write(`return ${returnPackage}.Map(future, ${$.transform}.MapDecode(
              func(decoder ${$.msgpack}.Reader) (${expandedKey}, error) {
              ${
        msgpackRead(
          context,
          false,
          "",
          false,
          "",
          m.keyType,
          false,
        )
      }}, func(decoder ${$.msgpack}.Reader) (${expandedVal}, error) {
            ${
        msgpackRead(
          context,
          false,
          "",
          false,
          "",
          m.valueType,
          false,
        )
      }}))`);
    } else if (!returns || isVoid(returns)) {
      this.write(
        `return ${returnPackage}.Map(future, ${$.transform}.Void.Decode)\n`,
      );
    } else {
      this.write(
        `return ${returnPackage}.Map(future, ${$.transform}.MsgPackDecode[${returnType}])\n`,
      );
    }
    this.write(`}\n\n`);
  }

  visitWrapperBeforeReturn(context: Context): void {
    this.triggerCallbacks(context, "WrapperBeforeReturn");
  }
}
