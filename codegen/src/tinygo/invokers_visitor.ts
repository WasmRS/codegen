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
  Kind,
  List,
  Named,
  Primitive,
  Stream,
} from "../deps/core/model.ts";
import {
  expandType,
  fieldName,
  getImporter,
  GoVisitor,
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
import { getOperationParts } from "./utilities.ts";
import { IMPORTS, primitiveTransformers } from "./constants.ts";

export class InvokersVisitor extends GoVisitor {
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
      this.write(` ${rxWrapper}[${expandType(t, undefined, true, translate)}]`);
    } else {
      this.write(` ${$.mono}.Void`);
    }
  }

  doHandler(context: Context): void {
    const tr = translateAlias(context);
    const { interface: iface, operation } = context;
    const $ = getImporter(context, IMPORTS);

    let receiver = "";
    if (iface) {
      const structName = iface.name + "Impl";
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
        `func ${methodName(operation, operation.name)}(ctx ${$.context}.Context`,
      );
    }

    operation.parameters.forEach((p) =>
      this.visitParam(context.clone({ parameter: p }))
    );
    this.write(`)`);
    this.visitOperationReturn(context);
    this.write(` {\n`);

    const { type, unaryIn, parameters, streamIn, returns, returnPackage } =
      getOperationParts(operation);

    const returnType = !returns || isVoid(returns)
      ? "struct{}"
      : expandType(returns, undefined, false, tr);

    if (unaryIn) {
      if (unaryIn.type.kind == Kind.Enum) {
        this
          .write(`payloadData, err := ${$.msgpack}.I32ToBytes(int32(${
            parameterName(
              unaryIn,
              unaryIn.name,
            )
          }))
        if err != nil {
          return ${returnPackage}.Error[${returnType}](err)
        }\n`);
      } else if (unaryIn.type.kind == Kind.Alias) {
        // const a = unaryIn.type as Alias;
        // const primitiveExpanded = expandType(a.type, undefined, false, tr);
        // const unaryParamExpanded = expandType(
        //   unaryIn.type,
        //   undefined,
        //   false,
        //   tr
        // );
        // this.write(`aliasVal, err := transform.${capitalize(
        //   primitiveExpanded
        // )}.Decode(p)
        //   if err != nil {
        //     return ${error}[payload.Payload](err)
        //   }
        //   request := ${unaryParamExpanded}(aliasVal)\n`);
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
          capitalize(
            p.name,
          )
        }ToBytes(${parameterName(unaryIn, unaryIn.name)})
        if err != nil {
          return ${returnPackage}.Error[${returnType}](err)
        }\n`);
      }
    } else {
      if (parameters.length > 0) {
        const argsName = operationArgsType(iface, operation);
        this.write(`request := ${argsName} {\n`);
        parameters.forEach((p) => {
          this.write(
            `\t${fieldName(p, p.name)}: ${parameterName(p, p.name)},\n`,
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
      ? `${receiver}.op${methodName(operation, operation.name)}`
      : `_op${methodName(operation, operation.name)}`;
    this.write(
      `var metadata [8]byte
      stream, ok := ${$.proxy}.FromContext(ctx)
      ${$.binary}.BigEndian.PutUint32(metadata[0:4], ${opVar})
      if ok {
        ${$.binary}.BigEndian.PutUint32(metadata[4:8], stream.StreamID())
      }
      pl := ${$.payload}.New(payloadData, metadata[:])\n`,
    );
    if (streamIn) {
      let transformFn = "";
      switch (streamIn.type.kind) {
        case Kind.Primitive: {
          const p = streamIn.type as Primitive;
          transformFn = `${$.transform}.${capitalize(p.name)}.Encode`;
          break;
        }
        case Kind.Alias: {
          const a = streamIn.type as Alias;
          if (a.type.kind == Kind.Primitive) {
            const p = a.type as Primitive;
            transformFn = `${$.transform}.${capitalize(p.name)}Encode[${a.name}]`;
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
        case Kind.Type:
        case Kind.Union: {
          const t = streamIn.type as Named;
          transformFn = `${$.transform}.MsgPackEncode[${t.name}]`;
          break;
        }
        default: {
          console.log(streamIn.type.kind);
        }
      }
      const inMap = `${$.flux}.Map(${streamIn.parameter.name}, ${transformFn})`;
      this.write(`future := gCaller.${type}(ctx, pl, ${inMap})\n`);
    } else {
      this.write(`future := gCaller.${type}(ctx, pl)\n`);
    }
    if (!returns || isVoid(returns)) {
      this.write(`return ${$.mono}.Map(future, ${$.transform}.Void.Decode)\n`);
    } else if (returns.kind == Kind.Alias) {
      const a = returns as Alias;
      if (a.type.kind == Kind.Primitive) {
        const p = a.type as Primitive;
        this.write(
          `return ${returnPackage}.Map(future, ${$.transform}.${
            capitalize(
              p.name,
            )
          }Decode[${a.name}])\n`,
        );
      } else {
        const expanded = expandType(a.type, undefined, undefined, tr);
        this.write(
          `return ${returnPackage}.Map(future, func(raw payload.Payload) (val ${a.name}, err error) {
            err = ${$.transform}.CodecDecode(raw, (*${expanded})(&val))
            return val, err
          })\n`,
        );
      }
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
      const expanded = expandType(l.type, undefined, undefined, tr);
      this.write(
        `return ${returnPackage}.Map(future, ${$.transform}.SliceDecode[${expanded}])\n`,
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
