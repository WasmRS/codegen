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
  Primitive,
  Stream,
} from "../deps/core/model.ts";
import {
  expandType,
  getImporter,
  GoVisitor,
  methodName,
  msgpackRead,
  msgpackVarAccessParam,
  returnShare,
  setExpandStreamPattern,
  translateAlias,
} from "../deps/codegen/go.ts";
import {
  capitalize,
  isHandler,
  isObject,
  isProvider,
  isVoid,
  noCode,
  operationArgsType,
  uncapitalize,
} from "../deps/codegen/utils.ts";
import { IMPORTS, primitiveTransformers } from "./constants.ts";

export class WrappersVisitor extends GoVisitor {
  visitContextBefore(_context: Context): void {
    setExpandStreamPattern("flux.Flux[{{type}}]");
  }

  visitOperation(context: Context): void {
    if (!isHandler(context) || noCode(context.operation)) {
      return;
    }
    this.doHandler(context);
  }

  visitFunction(context: Context): void {
    if (isProvider(context)) {
      return;
    }
    this.doRegister(context);
    this.doHandler(context);
  }

  doRegister(context: Context): void {
    const { namespace: ns, operation } = context;
    const $ = getImporter(context, IMPORTS);
    const handlerName = `${capitalize(operation.name)}Fn`;
    const wrapperName = `${uncapitalize(operation.name)}Wrapper`;
    let rxStyle = "RequestResponse";
    const streams = operation.parameters
      .filter((p) => p.type.kind == Kind.Stream)
      .map((p) => (p.type as Stream).type);
    const streamIn = streams.length > 0 ? streams[0] : undefined;

    if (streams.length > 1) {
      throw new Error(
        `There can only be zero or one stream parameter. Found ${streams.length}.`,
      );
    }
    if (streamIn || operation.type.kind == Kind.Stream) {
      rxStyle = streamIn ? "RequestChannel" : "RequestStream";
    }

    this.write(
      `func Register${capitalize(operation.name)}(handler ${handlerName}) {
        ${$.invoke}.Export${rxStyle}("${ns.name}", "${operation.name}", ${wrapperName}(handler))
    }\n\n`,
    );
  }

  doHandler(context: Context): void {
    const tr = translateAlias(context);
    const { interface: iface, operation } = context;
    const $ = getImporter(context, IMPORTS);
    const handlerName = `${capitalize(operation.name)}Fn`;
    const wrapperName = iface
      ? `${uncapitalize(iface.name)}${capitalize(operation.name)}Wrapper`
      : `${uncapitalize(operation.name)}Wrapper`;
    let rxStyle = "RequestResponse";
    let rxWrapper = "mono.Mono";
    let rxArgs = `p ${$.payload}.Payload`;
    let rxHandlerIn = ``;
    const rxPackage = operation.type.kind == Kind.Stream ? `${$.flux}` : `${$.mono}`;
    const streams = operation.parameters
      .filter((p) => p.type.kind == Kind.Stream)
      .map((p) => (p.type as Stream).type);
    const parameters = operation.parameters.filter(
      (p) => p.type.kind != Kind.Stream,
    );
    const streamIn = streams.length > 0 ? streams[0] : undefined;

    if (streams.length > 1) {
      throw new Error(
        `There can only be zero or one stream parameter. Found ${streams.length}.`,
      );
    }
    if (streamIn || operation.type.kind == Kind.Stream) {
      rxStyle = streamIn ? "RequestChannel" : "RequestStream";
      rxWrapper = `${$.flux}.Flux`;
    }
    if (streamIn) {
      rxArgs += `, in ${$.flux}.Flux[${$.payload}.Payload]`;
      switch (streamIn.kind) {
        case Kind.Primitive: {
          const prim = streamIn as Primitive;
          rxHandlerIn = `, ${$.flux}.Map(in, ${
            primitiveTransformers.get(
              prim.name,
            )
          }.Decode)`;
          break;
        }
        case Kind.Enum: {
          const e = streamIn as Enum;
          rxHandlerIn = `, ${$.flux}.Map(in, ${$.transform}.Int32Decode[${e.name}])`;
          break;
        }
        case Kind.Alias: {
          const a = streamIn as Alias;
          if (a.type.kind == Kind.Primitive) {
            const p = a.type as Primitive;
            rxHandlerIn = `, ${$.flux}.Map(in, ${$.transform}.${
              capitalize(
                p.name,
              )
            }Decode[${a.name}])`;
          } else {
            const expanded = expandType(a.type, undefined, undefined, tr);
            rxHandlerIn =
              `, ${$.flux}.Map(in, func(raw ${$.payload}.Payload) (val ${a.name}, err error) {
              err = ${$.transform}.CodecDecode(raw, (*${expanded})(&val))
              return val, err
            })`;
          }
          break;
        }
        default:
          rxHandlerIn = `, ${$.flux}.Map(in, ${$.transform}.MsgPackDecode[${
            expandType(
              streamIn,
              undefined,
              false,
              tr,
            )
          }])`;
          break;
      }
    }

    let handlerMethodName = "handler";
    if (iface) {
      this.write(
        `func ${wrapperName}(svc ${iface.name}) ${$.invoke}.${rxStyle}Handler {
          return func(ctx ${$.context}.Context, ${rxArgs}) ${rxWrapper}[payload.Payload] {\n`,
      );
      handlerMethodName = `svc.${methodName(operation, operation.name)}`;
    } else {
      this.write(
        `func ${wrapperName}(handler ${handlerName}) ${$.invoke}.${rxStyle}Handler {
          return func(ctx ${$.context}.Context, ${rxArgs}) ${rxWrapper}[${$.payload}.Payload] {\n`,
      );
    }
    if (operation.isUnary() && parameters.length > 0) {
      const unaryParam = parameters[0];
      if (unaryParam.type.kind == Kind.Enum) {
        const unaryParamExpanded = expandType(
          unaryParam.type,
          undefined,
          false,
          tr,
        );
        this.write(`enumVal, err := ${$.transform}.Int32.Decode(p)
        if err != nil {
          return ${rxPackage}.Error[${$.payload}.Payload](err)
        }
        request := ${unaryParamExpanded}(enumVal)\n`);
      } else if (unaryParam.type.kind == Kind.Alias) {
        const a = unaryParam.type as Alias;
        const primitiveExpanded = expandType(a.type, undefined, false, tr);
        const unaryParamExpanded = expandType(
          unaryParam.type,
          undefined,
          false,
          tr,
        );
        this.write(`aliasVal, err := ${$.transform}.${
          capitalize(
            primitiveExpanded,
          )
        }.Decode(p)
          if err != nil {
            return ${rxPackage}.Error[${$.payload}.Payload](err)
          }
          request := ${unaryParamExpanded}(aliasVal)\n`);
      } else if (isObject(unaryParam.type)) {
        this.write(`var request ${
          expandType(
            operation.unaryOp().type,
            undefined,
            false,
            tr,
          )
        }
        if err := ${$.transform}.CodecDecode(p, &request); err != nil {
          return ${rxPackage}.Error[${$.payload}.Payload](err)
        }\n`);
      } else {
        this.write(
          `decoder := ${$.msgpack}.NewDecoder(p.Data())
          ${
            msgpackRead(
              context,
              false,
              "request",
              true,
              "",
              unaryParam.type,
              false,
            )
          }`,
        );
        this.write(`if err != nil {
          return ${rxPackage}.Error[${$.payload}.Payload](err)
        }\n`);
      }
      this.write(
        `response := ${handlerMethodName}(ctx, ${
          returnShare(
            unaryParam.type,
          )
        }request${rxHandlerIn})\n`,
      );
    } else {
      if (parameters.length > 0) {
        const argsName = operationArgsType(iface, operation);
        this.write(`var inputArgs ${argsName}
        if err := ${$.transform}.CodecDecode(p, &inputArgs); err != nil {
          return ${rxPackage}.Error[${$.payload}.Payload](err)
        }\n`);
      }
      this.write(
        `response := ${handlerMethodName}(${
          msgpackVarAccessParam(
            "inputArgs",
            parameters,
          )
        }${rxHandlerIn})\n`,
      );
    }
    let returnType = operation.type;
    if (returnType.kind == Kind.Stream) {
      returnType = (returnType as Stream).type;
    }
    if (isVoid(returnType)) {
      this.visitWrapperBeforeReturn(context);
      this.write(`return ${$.mono}.Map(response, ${$.transform}.Void.Encode)\n`);
    } else if (returnType.kind == Kind.Primitive) {
      const prim = returnType as Primitive;
      this.write(
        `return ${rxPackage}.Map(response, ${
          primitiveTransformers.get(
            prim.name,
          )
        }.Encode)`,
      );
    } else if (returnType.kind == Kind.Alias) {
      const a = returnType as Alias;
      let transformFn = `${$.transform}.${capitalize(a.name)}.Encode`;
      if (a.type.kind == Kind.Primitive) {
        const p = a.type as Primitive;
        transformFn = `${$.transform}.${capitalize(p.name)}Encode[${a.name}]`;
      } else {
        const expanded = expandType(a.type, undefined, undefined, tr);
        transformFn = `func(value ${a.name}) (${$.payload}.Payload, error) {
            return ${$.transform}.CodecEncode((*${expanded})(&value))
          }`;
      }
      this.write(`return ${rxPackage}.Map(response, ${transformFn})`);
    } else if (returnType.kind == Kind.Enum) {
      const e = returnType as Enum;
      this.write(
        `return ${rxPackage}.Map(response, ${$.transform}.Int32Encode[${e.name}])`,
      );
    } else if (returnType.kind == Kind.List) {
      const l = returnType as List;
      const expanded = expandType(l.type, undefined, undefined, tr);
      this.write(
        `return ${$.mono}.Map(response, ${$.transform}.SliceEncode[${expanded}])`,
      );
    } else if (isObject(returnType)) {
      this.visitWrapperBeforeReturn(context);
      this.write(
        `return ${rxPackage}.Map(response, ${$.transform}.MsgPackEncode[${
          expandType(
            operation.type,
            undefined,
            false,
            tr,
          )
        }])\n`,
      );
    }
    this.write(`}
  }\n\n`);
  }

  visitWrapperBeforeReturn(context: Context): void {
    this.triggerCallbacks(context, "WrapperBeforeReturn");
  }
}
