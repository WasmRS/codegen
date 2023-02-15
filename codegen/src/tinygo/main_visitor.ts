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
  camelCase,
  InterfaceUsesVisitor,
  isService,
  UsesVisitor,
} from "../deps/codegen/utils.ts";
import {
  getImporter,
  getImports,
  GoVisitor,
  methodName,
} from "../deps/codegen/go.ts";
import { IMPORTS } from "./constants.ts";

export class MainVisitor extends GoVisitor {
  // Overridable visitor implementations
  usesVisitor = (writer: Writer): UsesVisitor =>
    new InterfaceUsesVisitor(writer);
  uses: UsesVisitor | undefined = undefined;

  writeHead(context: Context): void {
    const prev = context.config.package;
    context.config.package = "main";
    context.config.doNotEdit = false;
    super.writeHead(context);
    context.config.package = prev;
  }

  visitNamespaceBefore(context: Context): void {
    super.visitNamespaceBefore(context);

    this.uses = this.usesVisitor(this.writer);
    context.namespace.accept(context, this.uses);
  }

  visitAllOperationsBefore(context: Context): void {
    const $ = getImporter(context, IMPORTS);
    this.write(`\n`);

    const transport = context.config.transport as string || "wasmrs";

    this.write(`func main() {\n`);
    const packageName = getPackageName(context);

    if (transport == "rsocket") {
      this.write(`ctx := ${$.context}.Background()
      h := ${$.rsocket}.Handler(ctx)\n\n`);
    }

    const funcs = Object.values(context.namespace.functions);
    const services = Object.values(context.namespace.interfaces).filter((i) =>
      i.annotation("service") !== undefined ||
      i.annotation("events") !== undefined ||
      i.annotation("actor") !== undefined ||
      i.annotation("resource") !== undefined
    );
    const created = Object.values(context.namespace.interfaces).filter((i) =>
      i.annotation("service") !== undefined ||
      i.annotation("events") !== undefined ||
      i.annotation("actor") !== undefined
    );

    if (funcs.length > 0 || created.length > 0) {
      const importPath = context.config.import ||
        context.config.module ||
        "github.com/myorg/mymodule/pkg/module";
      const importer = getImports(context);
      importer.firstparty(importPath);
    }

    if (created.length > 0) {
      this.write(`// Create providers\n`);
      if (transport == "wasmrs") {
        this.write(
          `deps := ${packageName}.GetDependencies(${$.guest}.HostInvoker)\n`,
        );
      } else if (transport == "rsocket") {
        this.write(
          `deps := ${packageName}.GetDependencies(h)\n`,
        );
      }
      this.write(`\n`);

      this.write(`// Create services\n`);
      created.forEach(
        (service) => {
          this.write(
            `${
              camelCase(
                service.name,
              )
            }Service := ${packageName}.New${service.name}(deps)\n`,
          );
        },
      );
      this.write(`\n`);
    }

    if (funcs.length > 0 || services.length > 0) {
      this.write(`// Register services\n`);
      const registration = new HandlerRegistrationVisitor(
        this.writer,
      );
      context.namespace.accept(context, registration);
    }

    if (transport == "rsocket") {
      this.write(`if err := ${$.rsocket}.Connect(h); err != nil {
        panic(err)
      }\n`);
    }

    this.write(`}\n`);
  }
}

class HandlerRegistrationVisitor extends BaseVisitor {
  private hasResources = false;

  public visitFunction(context: Context): void {
    const packageName = getPackageName(context);
    const { operation } = context;

    this.write(
      `\t\t${packageName}.Register${
        methodName(
          operation,
          operation.name,
        )
      }(${packageName}.${
        methodName(
          operation,
          operation.name,
        )
      })\n`,
    );
  }

  visitInterface(context: Context): void {
    if (!isService(context)) {
      return;
    }
    const packageName = getPackageName(context);
    const { interface: iface } = context;

    this.write(
      `\t\t${packageName}.Register${iface.name}(${
        camelCase(
          iface.name,
        )
      }Service)\n`,
    );
  }

  public visitNamespaceAfter(context: Context): void {
    if (!this.hasResources) {
      return;
    }

    const packageName = getPackageName(context);
    this.write(
      `\t\t${packageName}.RegisterResources()\n`,
    );
  }
}

function getPackageName(context: Context): string {
  let packageName = context.config.import ||
    context.config.module ||
    "module";
  const idx = packageName.lastIndexOf("/");
  if (idx > 0) {
    packageName = packageName.substring(idx + 1);
  }
  return packageName;
}
