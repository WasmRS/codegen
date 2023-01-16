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
  AnyType,
  Context,
  Kind,
  Operation,
  Stream,
} from "../deps/core/model.ts";
import { ImportsVisitor as GoImportsVisitor } from "../deps/codegen/go.ts";

export class ImportsVisitor extends GoImportsVisitor {
  checkType(context: Context, type: AnyType): void {
    if (type.kind == Kind.Stream) {
      this.addType("flux", {
        type: "flux.Flux",
        import: "github.com/nanobus/iota/go/rx/flux",
      });
      type = (type as Stream).type;
    }
    super.checkType(context, type);
  }

  public visitEnum(_context: Context): void {
    this.addType("ERRORS", {
      type: "ERRORS",
      import: "errors",
    });
  }

  visitFunction(context: Context): void {
    this.checkReturn(context.operation);
    super.visitFunction(context);
  }

  visitOperation(context: Context): void {
    this.checkReturn(context.operation);
    super.visitOperation(context);
  }

  checkReturn(operation: Operation) {
    if (operation.type.kind != Kind.Stream) {
      this.addType("mono", {
        type: "mono.Mono",
        import: "github.com/nanobus/iota/go/rx/mono",
      });
    }
  }
}
