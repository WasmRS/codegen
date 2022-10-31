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
  BaseVisitor,
  Context,
  Kind,
  List,
  Map,
  Optional,
  Primitive,
  PrimitiveName,
  Stream,
  Writer,
} from "@apexlang/core/model";
import {
  Import,
  methodName,
  setExpandStreamPattern,
} from "@apexlang/codegen/go";
import { isHandler, isProvider, noCode } from "@apexlang/codegen/utils";
import { InvokersVisitor } from "./invokers_visitor.js";
import { getOperationParts } from "./utilities.js";

export class ImportBaseVisitor extends BaseVisitor {
  private hasAny: (context: Context) => boolean;
  private filter: (context: Context) => boolean;

  constructor(
    writer: Writer,
    hasAny: (context: Context) => boolean,
    filter: (context: Context) => boolean
  ) {
    super(writer);
    this.hasAny = hasAny;
    this.filter = filter;
  }

  visitContextBefore(context: Context): void {
    setExpandStreamPattern("flux.Flux[{{type}}]");
  }

  visitNamespace(context: Context): void {
    const { namespace: ns } = context;
    const packageName = context.config["package"] || "module";
    const importVisitor = new ImportsVisitor(this.writer, this.filter);
    ns.accept(context, importVisitor);
    const sortedStdLibs = Array.from(importVisitor.stdLibs).sort();
    const sortedImports = Array.from(importVisitor.imports).sort();

    this.write(`// Code generated by @apexlang/codegen. DO NOT EDIT.

    package ${packageName}\n`);

    if (!this.hasAny(context)) {
      this.write(`
    import (
      "github.com/nanobus/iota/go/wasmrs/invoke"
    )

    var (
      gCaller invoke.Caller
    )

    func Initialize(caller invoke.Caller) {
      gCaller = caller
    }\n\n`);
      return;
    }

    this.write(`
    import (
      "context"
      "encoding/binary"\n`);
    sortedStdLibs.forEach((i) => this.write(`"${i}"\n`));

    this.write(`\n"github.com/nanobus/iota/go/wasmrs/invoke"
      "github.com/nanobus/iota/go/wasmrs/payload"
      "github.com/nanobus/iota/go/wasmrs/proxy"\n`);
    sortedImports.forEach((i) => this.write(`"${i}"\n`));
    this.write(`"github.com/nanobus/iota/go/wasmrs/transform"\n`);
    this.write(`"github.com/nanobus/iota/go/msgpack"
    )\n\n`);

    const importedFuncs = Object.values(ns.functions).filter((f) =>
      isProvider(context.clone({ operation: f }))
    );

    this.write(`var (
      gCaller invoke.Caller\n`);

    importedFuncs.forEach((f) => {
      const parts = getOperationParts(f);
      this.write(
        `_op${methodName(f, f.name)} = invoke.Import${parts.type}("${
          ns.name
        }", "${f.name}")\n`
      );
    });

    this.write(`)

    func Initialize(caller invoke.Caller) {
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
        for (let name in ns.interfaces) {
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
        for (let name in ns.functions) {
          const iface = ns.functions[name];
          if (iface.annotation("provider")) {
            return true;
          }
        }
        return false;
      },
      (context: Context): boolean => {
        return !isProvider(context) || noCode(context.operation);
      }
    );
  }
}

export class ImportVisitor extends ImportBaseVisitor {
  constructor(writer: Writer) {
    super(
      writer,
      (context: Context): boolean => {
        const { namespace: ns } = context;
        for (let name in ns.interfaces) {
          const iface = ns.interfaces[name];
          if (iface.annotation("service")) {
            return true;
          }
        }
        for (let name in ns.functions) {
          const iface = ns.functions[name];
          if (iface.annotation("service")) {
            return true;
          }
        }
        return false;
      },
      (context: Context): boolean => {
        return !isHandler(context);
      }
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

  visitInterfaceAfter(context: Context): void {
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
    const parts = getOperationParts(operation);
    this.write(
      `op${methodName(operation, operation.name)}: invoke.Import${
        parts.type
      }("${ns.name}.${iface.name}", "${operation.name}"),\n`
    );
  }

  visitInterfaceAfter(context: Context): void {
    this.write(`}
    }\n\n`);
  }
}

class ImportsVisitor extends BaseVisitor {
  stdLibs: Set<string> = new Set();
  imports: Set<string> = new Set();
  private filter: (context: Context) => boolean;

  constructor(writer: Writer, filter: (context: Context) => boolean) {
    super(writer);
    this.filter = filter;
  }

  visitFunction(context: Context): void {
    this.visitOperation(context);
  }

  visitOperation(context: Context): void {
    if (this.filter(context)) {
      return;
    }
    const { operation } = context;
    if (operation.type.kind != Kind.Stream) {
      this.imports.add("github.com/nanobus/iota/go/wasmrs/rx/mono");
    }
    this.visitCheckType(context, operation.type);
  }

  visitParameter(context: Context): void {
    if (this.filter(context)) {
      return;
    }
    const { operation, parameter } = context;
    if (!operation.unary) {
      this.visitCheckType(context, parameter.type);
    }
  }

  visitCheckType(context: Context, t: AnyType): void {
    switch (t.kind) {
      case Kind.Primitive:
        const p = t as Primitive;
        if (p.name == PrimitiveName.DateTime) {
          this.stdLibs.add("time");
        }
        break;
      case Kind.Alias:
        const a = t as Alias;
        const aliases =
          (context.config.aliases as { [key: string]: Import }) || {};
        const t2 = aliases[a.name];
        if (t2 && t2.import) {
          this.imports.add(t2.import);
        } else {
          this.visitCheckType(context, a.type);
        }
        break;
      case Kind.Stream:
        this.imports.add("github.com/nanobus/iota/go/wasmrs/rx/flux");
        const s = t as Stream;
        this.visitCheckType(context, s.type);
        break;
      case Kind.Optional:
        const o = t as Optional;
        this.visitCheckType(context, o.type);
        break;
      case Kind.List:
        const l = t as List;
        this.visitCheckType(context, l.type);
        break;
      case Kind.Map:
        const m = t as Map;
        this.visitCheckType(context, m.keyType);
        this.visitCheckType(context, m.valueType);
        break;
    }
  }
}
