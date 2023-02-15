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
  private resources = new Set<string>();

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

    const importedFuncs = Object.values(ns.functions).filter((oper) => {
      const c = context.clone({ operation: oper });
      return !this.filter(c);
    });
    const importedIfaces = Object.values(ns.interfaces).filter((iface) => {
      const c = context.clone({ interface: iface });
      return !this.filter(c) || this.resources.has(iface.name);
    });

    this.write(`type Dependencies struct {\n`);
    importedFuncs.forEach((f) => {
      this.write(`${methodName(f, f.name)} ${methodName(f, f.name)}Fn\n`);
    });
    importedIfaces.forEach((i) => {
      this.write(`${i.name} ${i.name}\n`);
    });
    this.write(`}\n\n`);

    this.write(`type Client struct {
      caller invoke.Caller\n`);
    importedFuncs.forEach((f) => {
      this.write(
        `_op${methodName(f, f.name)} uint32\n`,
      );
    });
    importedIfaces.forEach((i) => {
      i.operations.forEach((o) => {
        this.write(
          `_op${i.name}${methodName(o, o.name)} uint32\n`,
        );
      });
    });
    this.write(`}

    func New(caller invoke.Caller) *Client {
      return &Client{
        caller: caller,\n`);

    importedFuncs.forEach((f) => {
      const parts = getOperationParts(f);
      this.write(
        `_op${
          methodName(f, f.name)
        }: ${$.invoke}.Import${parts.type}("${ns.name}", "${f.name}"),\n`,
      );
    });
    importedIfaces.forEach((i) => {
      i.operations.forEach((o) => {
        const parts = getOperationParts(o);
        this.write(
          `_op${i.name}${
            methodName(o, o.name)
          }: ${$.invoke}.Import${parts.type}("${ns.name}.${i.name}", "${o.name}"),\n`,
        );
      });
    });

    this.write(`}\n}\n`);

    this.write(`func (c *Client) Dependencies() Dependencies {
      return Dependencies{\n`);
    importedFuncs.forEach((f) => {
      this.write(`${methodName(f, f.name)}: c.${methodName(f, f.name)},\n`);
    });
    importedIfaces.forEach((i) => {
      this.write(`${i.name}: c.${i.name}(),\n`);
    });
    this.write(`}\n}

    func GetDependencies(caller invoke.Caller) Dependencies {
      c := New(caller)
      return c.Dependencies()
    }\n\n`);
  }

  visitFunction(context: Context): void {
    if (this.filter(context)) {
      return;
    }
    const invokersVisitor = new InvokersVisitor(this.writer, this.resources);
    context.operation.accept(context, invokersVisitor);
  }

  visitInterface(context: Context): void {
    const { interface: iface } = context;
    if (this.filter(context) && !this.resources.has(iface.name)) {
      return;
    }

    const providerStructVisitor = new ProviderStructVisitor(this.writer);
    iface.accept(context, providerStructVisitor);
    const providerNewVisitor = new ProviderNewVisitor(this.writer);
    iface.accept(context, providerNewVisitor);
    const invokersVisitor = new InvokersVisitor(this.writer, this.resources);
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
        if (!context.interface) {
          return true;
        }
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
        if (Object.keys(ns.functions).length > 0) {
          return true;
        }
        for (const name in ns.interfaces) {
          const iface = ns.interfaces[name];
          if (iface.annotation("service")) {
            return true;
          }
        }

        return false;
      },
      (context: Context): boolean => {
        if (!context.interface) {
          return false;
        }
        return !isHandler(context);
      },
    );
  }
}

class ProviderStructVisitor extends BaseVisitor {
  visitInterfaceBefore(context: Context): void {
    const { interface: iface } = context;
    this.write(`type ${iface.name}Client struct {
      c *Client
      instanceID uint64\n`);
  }

  visitInterfaceAfter(_context: Context): void {
    this.write(`}\n\n`);
  }
}

class ProviderNewVisitor extends BaseVisitor {
  visitInterfaceBefore(context: Context): void {
    const { interface: iface } = context;
    this.write(`func (c *Client) ${iface.name}() ${iface.name} {
      return &${iface.name}Client{
        c: c,\n`);
  }

  visitInterfaceAfter(_context: Context): void {
    this.write(`}
    }\n\n`);
  }
}
