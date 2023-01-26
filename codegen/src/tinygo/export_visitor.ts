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
  Context,
} from "../deps/core/model.ts";
import { GoVisitor } from "../deps/codegen/go.ts";
import { WrappersVisitor } from "./wrappers_visitor.ts";
import { RegisterVisitor } from "./register_visitor.ts";

export class ExportVisitor extends GoVisitor {
  visitNamespace(context: Context): void {
    const registerVisitor = new RegisterVisitor(this.writer);
    context.namespace.accept(context, registerVisitor);

    const wrappersVisitor = new WrappersVisitor(this.writer);
    context.namespace.accept(context, wrappersVisitor);
  }
}
