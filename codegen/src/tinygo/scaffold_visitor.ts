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

import { Context, Kind, Stream } from "../deps/core/model.ts";
import {
  expandType,
  getImporter,
  GoVisitor,
  mapParams,
  methodName,
  receiver,
  translateAlias,
} from "../deps/codegen/go.ts";
import {
  camelCase,
  isOneOfType,
  isVoid,
  noCode,
} from "../deps/codegen/utils.ts";
import { IMPORTS } from "./constants.ts";

interface Logger {
  import: string;
  interface: string;
}

function getLogger(context: Context): Logger | undefined {
  return context.config.logger as Logger;
}

export class ScaffoldVisitor extends GoVisitor {
  writeHead(context: Context): void {
    context.config.doNotEdit = false;
    super.writeHead(context);
  }

  visitNamespaceBefore(context: Context): void {
    super.visitNamespaceBefore(context);

    const service = new ServiceVisitor(this.writer);
    context.namespace.accept(context, service);
  }
}

class ServiceVisitor extends GoVisitor {
  visitInterfaceBefore(context: Context): void {
    const roleNames = (context.config.names as string[]) || [];
    const roleTypes = (context.config.types as string[]) || [];
    const { interface: iface } = context;
    const logger = getLogger(context);
    if (
      !isOneOfType(context, roleTypes) &&
      roleNames.indexOf(iface.name) == -1
    ) {
      return;
    }
    let dependencies: string[] = [];
    iface.annotation("uses", (a) => {
      if (a.arguments.length > 0) {
        dependencies = a.arguments[0].value.getValue() as string[];
      }
    });
    this.write(`
    type ${iface.name}Impl struct {\n`);
    if (logger) {
      this.write(`log ${logger.interface}\n`);
    }
    this.write(`${
      dependencies
        .map((e) => camelCase(e) + " " + e)
        .join("\n\t\t")
    }
    }

    func New${iface.name}(`);
    if (logger) {
      this.write(`log ${logger.interface}`);
      if (dependencies.length > 0) {
        this.write(`, `);
      }
    }
    this.write(`deps Dependencies) *${iface.name}Impl {
      return &${iface.name}Impl{\n`);
    if (logger) {
      this.write("log: log,\n");
    }
    this.write(`${
      dependencies
        .map((e) => camelCase(e) + `: deps.${e},`)
        .join("\n\t\t")
    }
      }
    }\n\n`);
  }

  visitFunction(context: Context): void {
    this.handleOperation(context);
  }

  visitOperation(context: Context): void {
    if (!isValid(context)) {
      return;
    }

    this.handleOperation(context);
  }

  handleOperation(context: Context): void {
    const $ = getImporter(context, IMPORTS);
    const { operation, interface: iface } = context;
    if (noCode(operation)) {
      return;
    }
    this.write(`\n`);
    if (iface) {
      this.write(
        `func (${receiver(iface)} *${iface.name}Impl) ${
          methodName(
            operation,
            operation.name,
          )
        }(`,
      );
    } else {
      this.write(
        `func ${
          methodName(
            operation,
            operation.name,
          )
        }(`,
      );
    }
    const translate = translateAlias(context);
    this.write(
      `${mapParams(context, operation.parameters, undefined, translate)})`,
    );
    if (!isVoid(operation.type)) {
      let t = operation.type;
      let rxWrapper;
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
    this.write(` {\n`);
    this.write(` // TODO: Provide implementation.\n`);
    if (!isVoid(operation.type)) {
      let t = operation.type;
      let rxWrapper;
      if (t.kind == Kind.Stream) {
        const s = t as Stream;
        t = s.type;
        rxWrapper = `${$.flux}`;
      } else {
        rxWrapper = `${$.mono}`;
      }
      const expanded = expandType(t, undefined, true, translate);
      this.write(
        `  return ${rxWrapper}.Error[${expanded}](${$.errors}.New("not_implemented"))\n`,
      );
    } else {
      this.write(
        `  return ${$.mono}.Error[struct{}](${$.errors}.New("not_implemented"))\n`,
      );
    }
    this.write(`}\n`);
  }
}

function isValid(context: Context): boolean {
  const roleNames = (context.config.names as string[]) || [];
  const roleTypes = (context.config.types as string[]) || [];
  const { interface: iface } = context;
  return isOneOfType(context, roleTypes) ||
    (iface && roleNames.indexOf(iface.name) != -1);
}
