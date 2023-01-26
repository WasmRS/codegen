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

import { BaseVisitor, Context, Writer } from "../deps/core/model.ts";
import {
  getImporter,
  GoVisitor,
  methodName,
  setExpandStreamPattern,
} from "../deps/codegen/go.ts";
import { isHandler, isProvider, noCode } from "../deps/codegen/utils.ts";
import { InvokersVisitor } from "./invokers_visitor.ts";
import { getOperationParts } from "./utilities.ts";
import { IMPORTS } from "./constants.ts";

export class ImportBaseVisitor extends GoVisitor {
  private hasAny: (context: Context) => boolean;
  private filter: (context: Context) => boolean;

  constructor(
    writer: Writer,
    hasAny: (context: Context) => boolean,
    filter: (context: Context) => boolean,
  ) {
    super(writer);
    this.hasAny = hasAny;
    this.filter = filter;
  }

  visitContextBefore(_context: Context): void {
    setExpandStreamPattern("flux.Flux[{{type}}]");
  }

  visitNamespace(context: Context): void {
    const { namespace: ns } = context;
    const $ = getImporter(context, IMPORTS);
    
    if (!this.hasAny(context)) {
      this.write(`
    var (
      gCaller ${$.invoke}.Caller
    )

    func Initialize(caller ${$.invoke}.Caller) {
      gCaller = caller
    }\n\n`);
      return;
    }

    const importedFuncs = Object.values(ns.functions).filter((f) =>
      isProvider(context.clone({ operation: f }))
    );

    this.write(`var (
      gCaller ${$.invoke}.Caller\n`);

    importedFuncs.forEach((f) => {
      const parts = getOperationParts(f);
      this.write(
        `_op${
          methodName(f, f.name)
        } = ${$.invoke}.Import${parts.type}("${ns.name}", "${f.name}")\n`,
      );
    });

    this.write(`)

    func Initialize(caller ${$.invoke}.Caller) {
      gCaller = caller
    }\n\n`);
  }

  visitFunction(context: Context): void {
    if (this.filter(context)) {
      return;
    }
    const invokersVisitor = new InvokersVisitor(this.writer);
    context.operation.accept(context, invokersVisitor);
  }

  visitInterface(context: Context): void {
    if (this.filter(context)) {
      return;
    }
    const { interface: iface } = context;

    const providerStructVisitor = new ProviderStructVisitor(this.writer);
    iface.accept(context, providerStructVisitor);
    const providerNewVisitor = new ProviderNewVisitor(this.writer);
    iface.accept(context, providerNewVisitor);
    const invokersVisitor = new InvokersVisitor(this.writer);
    iface.accept(context, invokersVisitor);
  }
}

export class ProviderVisitor extends ImportBaseVisitor {
  constructor(writer: Writer) {
    super(
      writer,
      (context: Context): boolean => {
        const { namespace: ns } = context;
        for (const name in ns.interfaces) {
          const iface = ns.interfaces[name];
          if (!iface.annotation("provider")) {
            continue;
          }
          if (
            iface.operations.find((o) => {
              return o.annotation("nocode") != undefined;
            }) == undefined
          ) {
            return true;
          }
        }
        for (const name in ns.functions) {
          const iface = ns.functions[name];
          if (iface.annotation("provider")) {
            return true;
          }
        }
        return false;
      },
      (context: Context): boolean => {
        return !isProvider(context) || noCode(context.operation);
      },
    );
  }
}

export class ImportVisitor extends ImportBaseVisitor {
  constructor(writer: Writer) {
    super(
      writer,
      (context: Context): boolean => {
        const { namespace: ns } = context;
        for (const name in ns.interfaces) {
          const iface = ns.interfaces[name];
          if (iface.annotation("service")) {
            return true;
          }
        }
        for (const name in ns.functions) {
          const iface = ns.functions[name];
          if (iface.annotation("service")) {
            return true;
          }
        }
        return false;
      },
      (context: Context): boolean => {
        return !isHandler(context);
      },
    );
  }
}

class ProviderStructVisitor extends BaseVisitor {
  visitInterfaceBefore(context: Context): void {
    const { interface: iface } = context;
    this.write(`type ${iface.name}Impl struct {\n`);
  }

  visitOperation(context: Context): void {
    const { operation } = context;
    this.write(`op${methodName(operation, operation.name)} uint32\n`);
  }

  visitInterfaceAfter(_context: Context): void {
    this.write(`}\n\n`);
  }
}

class ProviderNewVisitor extends BaseVisitor {
  visitInterfaceBefore(context: Context): void {
    const { interface: iface } = context;
    this.write(`func New${iface.name}() *${iface.name}Impl {
      return &${iface.name}Impl{\n`);
  }

  visitOperation(context: Context): void {
    const { namespace: ns, interface: iface, operation } = context;
    const $ = getImporter(context, IMPORTS);
    const parts = getOperationParts(operation);
    this.write(
      `op${
        methodName(operation, operation.name)
      }: ${$.invoke}.Import${parts.type}("${ns.name}.${iface.name}", "${operation.name}"),\n`,
    );
  }

  visitInterfaceAfter(_context: Context): void {
    this.write(`}
    }\n\n`);
  }
}
