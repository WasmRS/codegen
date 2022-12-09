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
  BaseVisitor,
  Context,
  Kind,
  Stream,
} from "https://deno.land/x/apex_core@v0.1.0/model/mod.ts";
import { setExpandStreamPattern } from "https://deno.land/x/apex_codegen@v0.1.0/go/mod.ts";
import {
  capitalize,
  isHandler,
  noCode,
  uncapitalize,
} from "https://deno.land/x/apex_codegen@v0.1.0/utils/mod.ts";

export class RegisterVisitor extends BaseVisitor {
  visitContextBefore(_context: Context): void {
    setExpandStreamPattern("flux.Flux[{{type}}]");
  }

  visitInterfaceBefore(context: Context): void {
    if (!isHandler(context) || noCode(context.operation)) {
      return;
    }

    const { interface: iface } = context;

    this.write(`func Register${iface.name}(svc ${iface.name}) {\n`);
  }

  visitOperation(context: Context): void {
    if (!isHandler(context) || noCode(context.operation)) {
      return;
    }

    const { namespace: ns, interface: iface, operation } = context;
    const wrapperName = `${uncapitalize(iface.name)}${
      capitalize(
        operation.name,
      )
    }Wrapper`;
    let rxStyle = "RequestResponse";
    const streams = operation.parameters
      .filter((p) => p.type.kind == Kind.Stream)
      .map((p) => (p.type as Stream).type);
    const streamIn = streams.length > 0 ? streams[0] : undefined;
    if (streamIn || operation.type.kind == Kind.Stream) {
      rxStyle = streamIn ? "RequestChannel" : "RequestStream";
    }

    this.write(
      `invoke.Export${rxStyle}("${ns.name}.${iface.name}", "${operation.name}", ${wrapperName}(svc))\n`,
    );
  }

  visitInterfaceAfter(context: Context): void {
    if (!isHandler(context) || noCode(context.operation)) {
      return;
    }

    this.write(`}\n\n`);
  }
}
