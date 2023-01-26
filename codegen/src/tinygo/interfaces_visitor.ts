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

import { Context, Visitor, Writer } from "../deps/core/model.ts";
import { InterfacesVisitor as GoInterfacesVisitor } from "../deps/codegen/go.ts";
import { InterfaceVisitor } from "./interface_visitor.ts";

export class InterfacesVisitor extends GoInterfacesVisitor {
  constructor(writer: Writer) {
    super(writer);
    this.serviceVisitor = (writer: Writer): Visitor =>
      new InterfaceVisitor(writer);
    this.dependencyVisitor = (writer: Writer): Visitor =>
      new InterfaceVisitor(writer);
  }

  visitContextBefore(context: Context): void {
    context.config.noEnumJSON = true;
  }
}
