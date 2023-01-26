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
import { getImporter, getImports, GoVisitor } from "../deps/codegen/go.ts";
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

    const importPath = context.config.import ||
      context.config.module ||
      "github.com/myorg/mymodule/pkg/module";
    const importer = getImports(context);
    importer.firstparty(importPath);

    this.uses = this.usesVisitor(this.writer);
    context.namespace.accept(context, this.uses);
  }

  visitAllOperationsBefore(context: Context): void {
    const $ = getImporter(context, IMPORTS);
    this.write(`\n`);

    this.write(`func main() {\n`);
    const packageName = getPackageName(context);

    this.write(`\t${packageName}.Initialize(${$.guest}.HostInvoker)\n\n`);
    this.write(`// Create providers\n`);
    this.uses!.dependencies.forEach((dependency) => {
      this.write(
        `${
          camelCase(
            dependency,
          )
        }Provider := ${packageName}.New${dependency}()\n`,
      );
    });

    this.write(`\n\n// Create services\n`);
    this.uses!.services.forEach((dependencies, service) => {
      const deps = dependencies
        .map((d) => camelCase(d) + "Provider")
        .join(", ");
      this.write(
        `${
          camelCase(
            service,
          )
        }Service := ${packageName}.New${service}(${deps})\n`,
      );
    });

    this.write(`\n\n// Register services\n`);
    const registration = new HandlerRegistrationVisitor(this.writer);
    context.namespace.accept(context, registration);
    this.write(`}\n`);
  }
}

class HandlerRegistrationVisitor extends BaseVisitor {
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