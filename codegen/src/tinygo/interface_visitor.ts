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

import { Context, Kind, Stream, Writer } from "../deps/core/model.ts";
import {
  expandType,
  getImporter,
  InterfaceVisitor as GoInterfaceVisitor,
  setExpandStreamPattern,
  translateAlias,
} from "../deps/codegen/go.ts";
import { isVoid } from "../deps/codegen/utils.ts";
import { IMPORTS } from "./constants.ts";

export class InterfaceVisitor extends GoInterfaceVisitor {
  constructor(writer: Writer) {
    super(writer);
    setExpandStreamPattern(`flux.Flux[{{type}}]`);
  }

  visitOperationReturn(context: Context): void {
    const { operation } = context;
    const $ = getImporter(context, IMPORTS);
    const translate = translateAlias(context);
    let rxWrapper;
    if (!isVoid(operation.type)) {
      let t = operation.type;
      if (t.kind == Kind.Stream) {
        const s = t as Stream;
        t = s.type;
        rxWrapper = `${$.flux}.Flux`;
      } else {
        rxWrapper = `${$.mono}.Mono`;
      }
      this.write(
        ` ${rxWrapper}[${expandType(t, undefined, true, translate)}]`,
      );
    } else {
      this.write(` ${$.mono}.Void`);
    }
  }
}
